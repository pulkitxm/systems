import { Trie } from "./trie.js";

export class AbuseMasker {
  private trie: Trie;

  constructor(trie: Trie) {
    this.trie = trie;
  }

  mask(message: string): string {
    if (message.length === 0) return message;

    const result: string[] = [];
    let wordStart = 0;
    let currentNode = this.trie.root;
    let matchEnd = -1;

    for (let i = 0; i <= message.length; i++) {
      const char = i < message.length ? message[i] : "";
      const isAlpha = /[a-zA-Z]/.test(char);

      if (isAlpha) {
        const nextNode = this.trie.getChild(currentNode, char);

        if (nextNode) {
          currentNode = nextNode;
          if (this.trie.isEnd(currentNode)) {
            matchEnd = i;
          }
        } else {
          currentNode = this.trie.root;
          matchEnd = -1;
        }
      } else {
        if (matchEnd >= 0 && matchEnd === i - 1) {
          const wordLen = matchEnd - wordStart + 1;
          result.push("*".repeat(wordLen));
        } else {
          for (let j = wordStart; j < i; j++) {
            result.push(message[j]);
          }
        }

        if (i < message.length) {
          result.push(char);
        }

        wordStart = i + 1;
        currentNode = this.trie.root;
        matchEnd = -1;
      }
    }

    return result.join("");
  }
}
