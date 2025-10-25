/**
 * Script Generation Node Implementation
 * Based on: .kiro/specs/auto-video-generation/nodes/04-script-generation.md
 *           .kiro/specs/auto-video-generation/requirements.md (Requirement 5)
 *
 * Features:
 * - Executes Claude CLI for script generation
 * - Default prompt generation when prompts.json is absent
 * - Script length validation (400-600 chars for AI news, 1500-2500 for tutorials)
 * - Script formatting (markdown removal, line break normalization)
 * - Retry logic with automatic length adjustment
 * - UTF-8 encoded script.txt output
 */

import { BaseNode } from './base/base-node.js';
import { NodeInput, NodeOutput, ScriptGenerationNodeConfig, ScriptData, ResearchData } from '../types/index.js';
import { execCommand } from '../utils/cli-executor.js';
import { readJson, writeText, fileExists, writeJson } from '../utils/file-utils.js';
import { retry } from '../utils/retry.js';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

export class ScriptGenerationNode extends BaseNode {
  constructor(config: ScriptGenerationNodeConfig) {
    super('ScriptGenerationNode', config);
  }

  /**
   * Execute the script generation node
   */
  protected async executeInternal(input: NodeInput): Promise<Omit<NodeOutput, 'metadata'>> {
    try {
      this.logger.info('Starting Script Generation Node execution');
      const config = this.config as ScriptGenerationNodeConfig;

      // Load research context
      const researchContext = await this.loadResearchContext(input.workDir);

      // Prepare script generation prompt
      const scriptPrompt = await this.prepareScriptPrompt(input, researchContext);

      this.logger.debug(`Script prompt (first 200 chars): ${scriptPrompt.substring(0, 200)}...`);

      // Execute Claude CLI with retry and length adjustment
      let scriptText = '';
      let retryAttempt = 0;
      const maxRetries = config.retryCount || 3;

      while (retryAttempt < maxRetries) {
        try {
          scriptText = await retry(
            () => this.executeClaudeCLI(scriptPrompt, config),
            {
              maxRetries: 1, // Single attempt per iteration (outer loop handles retries)
              baseDelay: config.retryDelay || 5000
            }
          );

          // Format script
          scriptText = this.formatScript(scriptText);

          // Validate length
          const validation = this.validateScriptLength(scriptText, config);

          if (validation.isValid) {
            this.logger.info(`Script generated successfully (${scriptText.length} chars)`);
            break;
          } else {
            this.logger.warn(`Script length validation failed: ${validation.message}`);

            if (retryAttempt < maxRetries - 1) {
              // Adjust script if possible
              if (config.autoAdjustLength !== false) {
                scriptText = this.adjustScriptLength(scriptText, config);
                const adjustedValidation = this.validateScriptLength(scriptText, config);

                if (adjustedValidation.isValid) {
                  this.logger.info(`Script adjusted to valid length (${scriptText.length} chars)`);
                  break;
                }
              }

              this.logger.info(`Retrying script generation (attempt ${retryAttempt + 2}/${maxRetries})`);
              retryAttempt++;
            } else {
              throw new Error(`Script length validation failed after ${maxRetries} attempts: ${validation.message}`);
            }
          }
        } catch (error) {
          if (retryAttempt >= maxRetries - 1) {
            throw error;
          }
          this.logger.warn(`Script generation attempt ${retryAttempt + 1} failed: ${(error as Error).message}`);
          retryAttempt++;
        }
      }

      // Prepare final output
      const finalData: ScriptData = {
        script: scriptText,
        generatedAt: new Date().toISOString(),
        length: scriptText.length,
        characterCount: scriptText.length,
        estimatedDuration: this.estimateDuration(scriptText, config)
      };

      // Save output to script.txt (UTF-8)
      const scriptPath = path.join(input.workDir, 'script.txt');
      await writeText(scriptPath, scriptText);

      // Also save metadata to script.json
      const metadataPath = path.join(input.workDir, 'script.json');
      await writeJson(metadataPath, finalData);

      this.logger.info(`Script Generation Node completed: ${finalData.length} chars, ~${finalData.estimatedDuration}s`);

      return this.createSuccessOutput(finalData, scriptPath);
    } catch (error) {
      this.logger.error('Script Generation Node execution failed', error as Error);
      return this.createFailureOutput(error as Error);
    }
  }

  /**
   * Load research context from research.json
   */
  private async loadResearchContext(workDir: string): Promise<ResearchData | null> {
    const researchPath = path.join(workDir, 'research.json');

    try {
      if (!(await fileExists(researchPath))) {
        this.logger.warn('research.json not found, proceeding without research context');
        return null;
      }

      const researchData = await readJson<ResearchData>(researchPath);
      this.logger.info(`Loaded research context: ${researchData.topicCount} topics`);
      return researchData;
    } catch (error) {
      this.logger.warn(`Failed to load research.json: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Prepare script generation prompt
   */
  private async prepareScriptPrompt(input: NodeInput, researchContext: ResearchData | null): Promise<string> {
    const promptsPath = path.join(input.workDir, 'prompts.json');

    // Try to load from prompts.json (from Prompt Refinement Node)
    if (await fileExists(promptsPath)) {
      this.logger.info('Loading script generation prompt from prompts.json');
      const prompts = await readJson<{ scriptPrompt: string }>(promptsPath);

      // Add research context if available
      if (researchContext) {
        const researchContextStr = this.formatResearchContext(researchContext);
        return `${prompts.scriptPrompt}\n\n【リサーチ情報】\n${researchContextStr}`;
      }

      return prompts.scriptPrompt;
    }

    // Fallback: Generate default prompt
    this.logger.info('prompts.json not found, generating default script generation prompt');
    return await this.generateDefaultPrompt(input, researchContext);
  }

  /**
   * Format research context for prompt
   */
  private formatResearchContext(researchData: ResearchData): string {
    return researchData.topics
      .map((topic, index) => {
        let formatted = `トピック${index + 1}: ${topic.title}\n`;
        formatted += `要約: ${topic.summary}\n`;
        if (topic.source) {
          formatted += `出典: ${topic.source}\n`;
        }
        return formatted;
      })
      .join('\n');
  }

  /**
   * Generate default prompt
   */
  private async generateDefaultPrompt(input: NodeInput, researchContext: ResearchData | null): Promise<string> {
    const config = this.config as ScriptGenerationNodeConfig;

    // Try to load strategy.json for context
    let contentType = config.defaultContentType || 'tutorial';
    let theme = config.defaultTheme || 'technology trends';

    const strategyPath = path.join(input.workDir, 'strategy.json');
    if (await fileExists(strategyPath)) {
      try {
        const strategy = await readJson<{ contentType?: string; contentTheme?: string }>(strategyPath);
        contentType = strategy.contentType || contentType;
        theme = strategy.contentTheme || theme;
        this.logger.info(`Loaded content type and theme from strategy.json`);
      } catch (error) {
        this.logger.warn(`Failed to load strategy.json: ${(error as Error).message}`);
      }
    }

    return this.buildDefaultPrompt(contentType, theme, researchContext, config);
  }

  /**
   * Build default prompt from template
   */
  private buildDefaultPrompt(
    contentType: string,
    theme: string,
    researchContext: ResearchData | null,
    config: ScriptGenerationNodeConfig
  ): string {
    // Determine length range based on content type
    const lengthRange = config.lengthRange || (
      contentType === 'ai-news'
        ? { min: 400, max: 600 }
        : { min: 1500, max: 2500 }
    );

    // Get structure configuration
    const structure = config.structure || this.getDefaultStructure(contentType);

    // Get tone
    const tone = config.tone || 'professional';

    // Build prompt parts
    let prompt = `以下のテーマについて、YouTube動画の原稿を生成してください。\n\n`;
    prompt += `テーマ: ${theme}\n`;
    prompt += `コンテンツタイプ: ${contentType}\n`;
    prompt += `トーン: ${this.getToneDescription(tone)}\n\n`;

    // Add research context if available
    if (researchContext) {
      prompt += `【リサーチ情報】\n${this.formatResearchContext(researchContext)}\n\n`;
    }

    // Add structure instructions
    prompt += `【構成要件】\n`;
    prompt += `1. オープニング (${structure.opening.duration || 10}秒)\n`;
    prompt += `   - ${structure.opening.content || 'テーマの紹介と視聴者への挨拶'}\n\n`;

    if (contentType === 'ai-news') {
      prompt += `2. メイントピック (各${structure.topics.duration || 20}秒)\n`;
      prompt += `   - ${structure.topics.content || '各ニュースの要点を簡潔に説明'}\n`;
      prompt += `   - リサーチ情報から各トピックを取り上げてください\n\n`;
    } else {
      prompt += `2. メインコンテンツ (${structure.topics.duration || 120}秒)\n`;
      prompt += `   - ${structure.topics.content || '具体例や手順の詳細な説明'}\n\n`;
    }

    prompt += `3. クロージング (${structure.closing.duration || 10}秒)\n`;
    prompt += `   - ${structure.closing.content || 'まとめと視聴者への行動喚起'}\n\n`;

    // Add length requirements
    prompt += `【文字数要件】\n`;
    prompt += `- 目標文字数: ${lengthRange.min}〜${lengthRange.max}文字\n`;
    prompt += `- 1秒あたり約${config.charsPerSecond || 6}文字を想定\n\n`;

    // Add formatting requirements
    prompt += `【出力形式】\n`;
    prompt += `- プレーンテキストで出力してください（Markdownは使用しない）\n`;
    prompt += `- 原稿テキストのみを出力してください（説明や注釈は不要）\n`;
    prompt += `- 改行は段落の区切りのみに使用してください\n`;

    // Add custom instructions if provided
    if (config.customInstructions) {
      prompt += `\n【追加指示】\n${config.customInstructions}\n`;
    }

    return prompt;
  }

  /**
   * Get default structure based on content type
   */
  private getDefaultStructure(contentType: string): any {
    if (contentType === 'ai-news') {
      return {
        opening: {
          duration: 10,
          content: '今日のAIニュースを3つお届けします'
        },
        topics: {
          duration: 20,
          content: '各ニュースの要点を簡潔に説明'
        },
        closing: {
          duration: 10,
          content: 'まとめとチャンネル登録の呼びかけ'
        }
      };
    } else {
      return {
        opening: {
          duration: 15,
          content: 'チュートリアルの概要と目標の説明'
        },
        topics: {
          duration: 120,
          content: '具体的な手順や例を詳しく解説'
        },
        closing: {
          duration: 15,
          content: 'まとめと次のステップの提案'
        }
      };
    }
  }

  /**
   * Get tone description
   */
  private getToneDescription(tone: string): string {
    const toneDescriptions: Record<string, string> = {
      enthusiastic: '熱意を持って、エネルギッシュに',
      professional: '専門的で、落ち着いたトーン',
      casual: 'カジュアルで親しみやすく',
      neutral: '中立的で事実に基づいた'
    };

    return toneDescriptions[tone] || toneDescriptions.professional;
  }

  /**
   * Execute Claude CLI
   */
  private async executeClaudeCLI(prompt: string, config: ScriptGenerationNodeConfig): Promise<string> {
    const command = config.claudeCommand || 'claude';

    // Write prompt to temporary file
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `claude-prompt-${Date.now()}.txt`);

    try {
      await writeText(tempFile, prompt);

      // Execute Claude CLI with prompt file
      const args = [...(config.claudeArgs || []), '-f', tempFile];

      this.logger.debug(`Executing Claude CLI: ${command} ${args.slice(0, -1).join(' ')} -f [temp]`);

      const result = await execCommand(command, args, {
        timeout: config.timeout || 300000 // 5 minutes default
      });

      return result.stdout;
    } finally {
      // Clean up temp file
      try {
        await fs.unlink(tempFile);
      } catch (error) {
        this.logger.warn(`Failed to delete temp file: ${tempFile}`);
      }
    }
  }

  /**
   * Format script (remove markdown, normalize line breaks)
   */
  private formatScript(text: string): string {
    let formatted = text;

    // Remove markdown headers (### Title -> Title)
    formatted = formatted.replace(/^#{1,6}\s+/gm, '');

    // Remove bold/italic markdown (**text** or *text* -> text)
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '$1');
    formatted = formatted.replace(/\*([^*]+)\*/g, '$1');

    // Remove code blocks (```...``` -> ...)
    formatted = formatted.replace(/```[\s\S]*?```/g, '');
    formatted = formatted.replace(/`([^`]+)`/g, '$1');

    // Remove list markers (- item or * item -> item)
    formatted = formatted.replace(/^[*\-]\s+/gm, '');

    // Normalize multiple line breaks to double line break
    formatted = formatted.replace(/\n{3,}/g, '\n\n');

    // Trim leading/trailing whitespace
    formatted = formatted.trim();

    return formatted;
  }

  /**
   * Validate script length
   */
  private validateScriptLength(
    script: string,
    config: ScriptGenerationNodeConfig
  ): { isValid: boolean; message: string } {
    const length = script.length;
    const contentType = config.defaultContentType || 'tutorial';

    // Default ranges based on content type
    const defaultRange = contentType === 'ai-news'
      ? { min: 400, max: 600 }
      : { min: 1500, max: 2500 };

    const lengthRange = config.lengthRange || defaultRange;

    if (length < lengthRange.min) {
      return {
        isValid: false,
        message: `Script too short: ${length} chars (minimum: ${lengthRange.min})`
      };
    }

    if (length > lengthRange.max) {
      return {
        isValid: false,
        message: `Script too long: ${length} chars (maximum: ${lengthRange.max})`
      };
    }

    return {
      isValid: true,
      message: `Script length valid: ${length} chars`
    };
  }

  /**
   * Adjust script length (truncate if too long)
   */
  private adjustScriptLength(script: string, config: ScriptGenerationNodeConfig): string {
    const contentType = config.defaultContentType || 'tutorial';
    const defaultRange = contentType === 'ai-news'
      ? { min: 400, max: 600 }
      : { min: 1500, max: 2500 };

    const lengthRange = config.lengthRange || defaultRange;

    if (script.length <= lengthRange.max) {
      return script;
    }

    // Truncate to max length, trying to break at sentence end
    const maxLength = lengthRange.max;
    const truncated = script.substring(0, maxLength);

    // Find last sentence-ending punctuation (。or．or.or！or?)
    const lastSentenceEnd = Math.max(
      truncated.lastIndexOf('。'),
      truncated.lastIndexOf('．'),
      truncated.lastIndexOf('.'),
      truncated.lastIndexOf('！'),
      truncated.lastIndexOf('？')
    );

    if (lastSentenceEnd > maxLength * 0.8) {
      // If we can find a sentence end in the last 20%, use it
      return truncated.substring(0, lastSentenceEnd + 1);
    }

    // Otherwise, just truncate at max length
    this.logger.warn(`Script truncated at ${maxLength} chars (no sentence break found)`);
    return truncated;
  }

  /**
   * Estimate duration in seconds
   */
  private estimateDuration(script: string, config: ScriptGenerationNodeConfig): number {
    const charsPerSecond = config.charsPerSecond || 6;
    return Math.ceil(script.length / charsPerSecond);
  }
}
