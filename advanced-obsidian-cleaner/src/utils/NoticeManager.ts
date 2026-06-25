import { Notice } from 'obsidian';

export class NoticeManager {
  static error(msg: string): void { new Notice(msg, 5000); }
  static warning(msg: string): void { new Notice(msg, 4000); }
  static info(msg: string): void { new Notice(msg, 3000); }
  static success(msg: string): void { new Notice(msg, 2000); }
}
