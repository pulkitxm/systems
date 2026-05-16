import { writeFileSync, readFileSync, existsSync } from "fs";
import { getAbuseWordsFilePath } from "./abuse-words-source.js";

class TrieNode {
  children: Map<string, TrieNode> = new Map();
  isEndOfWord = false;
}

export class Trie {
  root: TrieNode = new TrieNode();
  private wordCount = 0;

  insert(word: string): void {
    let node = this.root;
    const normalizedWord = word.toLowerCase().trim();

    for (const char of normalizedWord) {
      if (!node.children.has(char)) {
        node.children.set(char, new TrieNode());
      }
      node = node.children.get(char)!;
    }

    if (!node.isEndOfWord) {
      node.isEndOfWord = true;
      this.wordCount++;
    }
  }

  getChild(node: TrieNode, char: string): TrieNode | null {
    return node.children.get(char.toLowerCase()) ?? null;
  }

  isEnd(node: TrieNode): boolean {
    return node.isEndOfWord;
  }

  getWordCount(): number {
    return this.wordCount;
  }

  async loadFromUrl(url: string, localPath?: string): Promise<void> {
    const filePath = localPath ?? getAbuseWordsFilePath();

    console.log(`Fetching abuse word list from: ${url}`);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch abuse list: ${response.status} ${response.statusText}`);
    }

    const content = await response.text();
    writeFileSync(filePath, content, "utf-8");
    console.log(`Saved abuse word list to: ${filePath}`);

    this.loadFromContent(content);
  }

  loadFromFile(filePath: string): void {
    if (!existsSync(filePath)) {
      throw new Error(`Abuse word file not found: ${filePath}`);
    }

    const content = readFileSync(filePath, "utf-8");
    this.loadFromContent(content);
  }

  private loadFromContent(content: string): void {
    const lines = content.split("\n");

    for (const line of lines) {
      const word = line.trim();
      if (word.length > 0) {
        this.insert(word);
      }
    }

    console.log(`Loaded ${this.wordCount} abuse words into trie`);
  }
}
