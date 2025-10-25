/**
 * Research Node Implementation
 * Based on: .kiro/specs/auto-video-generation/nodes/03-research.md
 *           .kiro/specs/auto-video-generation/requirements.md (Requirement 4)
 *
 * Features:
 * - Executes Codex CLI for information gathering
 * - Default prompt generation when prompts.json is absent
 * - Topic count specification (default 3, configurable 3-4 for AI news)
 * - Duplicate checking with topic history management
 * - Retry logic with exponential backoff
 * - Output parsing (JSON and text fallback)
 */

import { BaseNode } from './base/base-node.js';
import { NodeInput, NodeOutput, ResearchNodeConfig, ResearchData, ResearchTopic, TopicHistory } from '../types/index.js';
import { execCommand } from '../utils/cli-executor.js';
import { readJson, writeJson, fileExists, ensureDir } from '../utils/file-utils.js';
import { retry } from '../utils/retry.js';
import path from 'path';

export class ResearchNode extends BaseNode {
  constructor(config: ResearchNodeConfig) {
    super('ResearchNode', config);
  }

  /**
   * Execute the research node
   */
  protected async executeInternal(input: NodeInput): Promise<Omit<NodeOutput, 'metadata'>> {
    try {
      this.logger.info('Starting Research Node execution');
      const config = this.config as ResearchNodeConfig;

      // Load previous topics for duplicate check
      const previousTopics = await this.loadPreviousTopics(config);

      // Prepare research prompt
      let researchPrompt = await this.prepareResearchPrompt(input);

      // Add exclusion instruction if duplicate check is enabled
      if (config.enableDuplicateCheck !== false && previousTopics.length > 0) {
        const excludeInstruction = `\n\n【除外すべきトピック】\n以下のトピックは過去${config.duplicateCheckDays || 7}日間で既に扱っているため、避けてください：\n${previousTopics.map(t => `- ${t}`).join('\n')}`;
        researchPrompt += excludeInstruction;
      }

      this.logger.debug(`Research prompt (first 200 chars): ${researchPrompt.substring(0, 200)}...`);

      // Execute Codex CLI with retry
      const rawOutput = await retry(
        () => this.executeCodexCLI(researchPrompt, config),
        {
          maxRetries: config.retryCount || 3,
          baseDelay: config.retryDelay || 5000
        }
      );

      // Parse output
      const parsedData = this.parseCodexOutput(rawOutput);

      // Validate and process results
      let researchData = this.processResearchResults(parsedData);

      // Check for duplicates
      const newTopics = researchData.topics.map(t => t.title);
      const uniqueTopics = this.checkDuplicates(newTopics, previousTopics);

      // Filter results to only include unique topics
      researchData.topics = researchData.topics.filter(t => uniqueTopics.includes(t.title));

      // Log warning if too many duplicates were filtered
      if (researchData.topics.length < (config.topicCount || 3)) {
        this.logger.warn(`Only ${researchData.topics.length} unique topics found (expected ${config.topicCount || 3})`);
      }

      // Save topic history
      await this.saveTopicHistory(uniqueTopics, config);

      // Prepare final output
      const finalData: ResearchData = {
        topics: researchData.topics,
        generatedAt: new Date().toISOString(),
        topicCount: researchData.topics.length
      };

      // Save output to research.json
      const outputPath = path.join(input.workDir, 'research.json');
      await writeJson(outputPath, finalData);

      this.logger.info(`Research Node completed: ${finalData.topicCount} unique topics saved`);

      return this.createSuccessOutput(finalData, outputPath);
    } catch (error) {
      this.logger.error('Research Node execution failed', error as Error);
      return this.createFailureOutput(error as Error);
    }
  }

  /**
   * Prepare research prompt
   */
  private async prepareResearchPrompt(input: NodeInput): Promise<string> {
    const promptsPath = path.join(input.workDir, 'prompts.json');

    // Try to load from prompts.json (from Prompt Refinement Node)
    if (await fileExists(promptsPath)) {
      this.logger.info('Loading research prompt from prompts.json');
      const prompts = await readJson<{ researchPrompt: string }>(promptsPath);
      return prompts.researchPrompt;
    }

    // Fallback: Generate default prompt
    this.logger.info('prompts.json not found, generating default research prompt');
    return await this.generateDefaultPrompt(input);
  }

  /**
   * Generate default prompt
   */
  private async generateDefaultPrompt(input: NodeInput): Promise<string> {
    const config = this.config as ResearchNodeConfig;

    // Try to load strategy.json for context
    let theme = config.defaultTheme || 'technology trends';
    let keywords = config.defaultKeywords || ['tutorial', 'guide'];

    const strategyPath = path.join(input.workDir, 'strategy.json');
    if (await fileExists(strategyPath)) {
      try {
        const strategy = await readJson<{ contentTheme?: string; keywords?: string[] }>(strategyPath);
        theme = strategy.contentTheme || theme;
        keywords = strategy.keywords || keywords;
        this.logger.info(`Loaded theme and keywords from strategy.json`);
      } catch (error) {
        this.logger.warn(`Failed to load strategy.json: ${(error as Error).message}`);
      }
    }

    return this.buildDefaultPrompt(theme, keywords, config);
  }

  /**
   * Build default prompt from template
   */
  private buildDefaultPrompt(theme: string, keywords: string[], config: ResearchNodeConfig): string {
    const keywordStr = keywords.join(', ');

    // Fixed parts (universal - guaranteed by system)
    const fixedPrefix = config.promptTemplate?.fixedPrefix ||
      '以下のテーマについて最新の情報をリサーチしてください：';

    const fixedSuffix = config.promptTemplate?.fixedSuffix || `
出力形式：
- 各情報源のタイトルと要約
- 重要なポイントのリスト
- 参考URL（可能な場合）`;

    // Variable parts (customizable)
    const customRequirements = config.promptTemplate?.customRequirements || [
      '最新のトレンドや動向',
      '実用的な情報や事例',
      '信頼できる情報源からのデータ'
    ];

    const customInstructions = config.promptTemplate?.customInstructions || '';

    // Topic count instruction
    const topicCount = config.topicCount || 3;
    const topicInstruction = `\n【重要】\n${topicCount}つの異なるトピック/ニュースを収集してください。各トピックは独立した内容であること。`;

    // Build prompt
    return `
${fixedPrefix}

テーマ: ${theme}
キーワード: ${keywordStr}

リサーチ要件：
${customRequirements.map((req: string) => `- ${req}`).join('\n')}
${topicInstruction}

${customInstructions ? `追加指示：\n${customInstructions}\n` : ''}
${fixedSuffix}
`.trim();
  }

  /**
   * Execute Codex CLI
   */
  private async executeCodexCLI(prompt: string, config: ResearchNodeConfig): Promise<string> {
    const command = config.codexCommand || 'codex';
    const args = [...(config.codexArgs || ['--search']), prompt];

    this.logger.debug(`Executing Codex CLI: ${command} ${args[0]}`);

    const result = await execCommand(command, args, {
      timeout: config.timeout || 600000 // 10 minutes default
    });

    return result.stdout;
  }

  /**
   * Parse Codex output
   */
  private parseCodexOutput(output: string): { topics: ResearchTopic[] } {
    try {
      // Attempt to parse as JSON first
      const jsonData = JSON.parse(output);
      return this.normalizeResearchData(jsonData);
    } catch {
      // Fallback: parse as plain text
      this.logger.debug('JSON parsing failed, falling back to text parsing');
      return this.parseTextOutput(output);
    }
  }

  /**
   * Normalize research data from JSON
   */
  private normalizeResearchData(data: any): { topics: ResearchTopic[] } {
    const results = data.results || [];
    const topics: ResearchTopic[] = results.map((r: any) => ({
      title: r.title || 'Untitled',
      summary: r.content || r.summary || '',
      source: r.source || r.url,
      date: r.date || new Date().toISOString()
    }));

    return { topics };
  }

  /**
   * Parse text output (fallback)
   */
  private parseTextOutput(text: string): { topics: ResearchTopic[] } {
    const lines = text.split('\n').filter(line => line.trim());
    const topics: ResearchTopic[] = [];

    let currentTopic: Partial<ResearchTopic> | null = null;

    for (const line of lines) {
      if (line.startsWith('Title:') || line.startsWith('##')) {
        if (currentTopic && currentTopic.title) {
          topics.push(currentTopic as ResearchTopic);
        }
        currentTopic = {
          title: line.replace(/^(Title:|##)\s*/, '').trim(),
          summary: '',
          date: new Date().toISOString()
        };
      } else if (currentTopic && line.startsWith('Source:')) {
        currentTopic.source = line.replace(/^Source:\s*/, '').trim();
      } else if (currentTopic && line.trim()) {
        currentTopic.summary = (currentTopic.summary || '') + line + '\n';
      }
    }

    if (currentTopic && currentTopic.title) {
      topics.push(currentTopic as ResearchTopic);
    }

    return { topics };
  }

  /**
   * Process research results
   */
  private processResearchResults(
    parsedData: { topics: ResearchTopic[] }
  ): { topics: ResearchTopic[] } {
    // If no results, use placeholder
    if (!parsedData.topics || parsedData.topics.length === 0) {
      this.logger.warn('No research results found, using placeholder data');
      return { topics: this.getPlaceholderResults() };
    }

    return parsedData;
  }

  /**
   * Get placeholder results
   */
  private getPlaceholderResults(): ResearchTopic[] {
    return [
      {
        title: 'プレースホルダー情報1',
        summary: 'リサーチ結果が取得できなかったため、プレースホルダーデータを使用しています。',
        date: new Date().toISOString()
      },
      {
        title: 'プレースホルダー情報2',
        summary: '実際の運用では、Codex CLIから有効なデータが返されます。',
        date: new Date().toISOString()
      },
      {
        title: 'プレースホルダー情報3',
        summary: 'これはテスト用のダミーデータです。',
        date: new Date().toISOString()
      }
    ];
  }

  /**
   * Load previous topics from history
   */
  private async loadPreviousTopics(config: ResearchNodeConfig): Promise<string[]> {
    const historyPath = config.topicHistoryPath || path.join('cache', 'topic-history.json');
    const daysToCheck = config.duplicateCheckDays || 7;

    try {
      if (!(await fileExists(historyPath))) {
        return [];
      }

      const history = await readJson<TopicHistory>(historyPath);

      // Filter topics from the last N days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToCheck);

      const recentTopics = history.entries
        .filter(entry => new Date(entry.date) >= cutoffDate)
        .map(entry => entry.title);

      this.logger.info(`Loaded ${recentTopics.length} topics from the last ${daysToCheck} days`);
      return recentTopics;
    } catch (error) {
      this.logger.warn(`Failed to load topic history: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * Save topic history
   */
  private async saveTopicHistory(topics: string[], config: ResearchNodeConfig): Promise<void> {
    const historyPath = config.topicHistoryPath || path.join('cache', 'topic-history.json');
    const maxHistoryDays = config.maxHistoryDays || 30;

    try {
      // Ensure cache directory exists
      const cacheDir = path.dirname(historyPath);
      await ensureDir(cacheDir);

      // Load existing history
      let history: TopicHistory = { entries: [], lastUpdated: '' };
      if (await fileExists(historyPath)) {
        history = await readJson<TopicHistory>(historyPath);
      }

      // Add today's topics
      const today = new Date().toISOString().split('T')[0];
      topics.forEach(topic => {
        history.entries.push({
          title: topic,
          date: today
        });
      });

      // Remove old entries
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - maxHistoryDays);
      history.entries = history.entries.filter(entry => new Date(entry.date) >= cutoffDate);

      // Update timestamp
      history.lastUpdated = new Date().toISOString();

      // Save updated history
      await writeJson(historyPath, history);
      this.logger.info(`Saved ${topics.length} topics to history`);
    } catch (error) {
      this.logger.error(`Failed to save topic history: ${(error as Error).message}`);
    }
  }

  /**
   * Check for duplicate topics
   */
  private checkDuplicates(newTopics: string[], previousTopics: string[]): string[] {
    if (previousTopics.length === 0) {
      return newTopics;
    }

    const uniqueTopics = newTopics.filter(topic => {
      const topicLower = topic.toLowerCase();
      return !previousTopics.some(prev => {
        const prevLower = prev.toLowerCase();
        // Check for exact match or high similarity
        return prevLower === topicLower || this.calculateSimilarity(topicLower, prevLower) > 0.7;
      });
    });

    const duplicateCount = newTopics.length - uniqueTopics.length;
    if (duplicateCount > 0) {
      this.logger.info(`Filtered out ${duplicateCount} duplicate topics`);
    }

    return uniqueTopics;
  }

  /**
   * Calculate similarity between two strings (simple word-based)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = new Set(str1.split(/\s+/));
    const words2 = new Set(str2.split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }
}
