import { Modal, App, setIcon } from 'obsidian';

export type ModalSize = 'small' | 'medium' | 'large';

const MODAL_SIZE_DIMENSIONS: Record<
  ModalSize,
  { width: string; minWidth: string; maxWidth?: string }
> = {
  small: { width: '400px', minWidth: '350px' },
  medium: { width: '860px', minWidth: '640px', maxWidth: '95vw' },
  large: { width: '980px', minWidth: '760px', maxWidth: '95vw' },
};

const MOBILE_MODAL_SHELL_STYLES: ReadonlyArray<readonly [string, string]> = [
  ['width', '100%'],
  ['max-width', '100%'],
  ['margin', '0'],
  ['border-radius', '0'],
  ['max-height', '100vh'],
  ['height', '100vh'],
];

const MODAL_SHELL_STYLE_PRIORITY = 'important';

export interface BaseModalOptions {
  title?: string;
  titleIcon?: string;
  cssClass?: string;
  size?: ModalSize;
  autoFocus?: boolean;
  focusSelector?: string;
}

export abstract class BaseModal extends Modal {
  protected options: BaseModalOptions;

  constructor(app: App, options: BaseModalOptions = {}) {
    super(app);
    this.options = {
      autoFocus: true,
      focusSelector: '.mod-cta',
      ...options,
    };
  }

  onOpen() {
    this.clearContent();
    this.addCssClass();
    this.setModalSize();
    this.createTitle();
    this.createContent();
    this.setupAutoFocus();
    this.resetScrollPosition();
  }

  protected resetScrollPosition(): void {
    const resetScroll = () => {
      if (this.contentEl) {
        this.contentEl.scrollTop = 0;
      }
      const modalContainer = this.modalEl;
      if (modalContainer) {
        modalContainer.scrollTop = 0;
        const modalParent = modalContainer.parentElement;
        if (modalParent) {
          modalParent.scrollTop = 0;
        }
      }
    };

    resetScroll();
    window.requestAnimationFrame(() => {
      resetScroll();
      window.setTimeout(() => resetScroll(), 50);
    });
  }

  onClose() {
    this.clearModalSizeStyles();
    this.clearContent();
  }

  protected clearContent(): void {
    this.contentEl.empty();
  }

  protected addCssClass(): void {
    if (this.options.cssClass) {
      this.contentEl.addClass(this.options.cssClass);
    }
  }

  protected setModalSize(): void {
    const modalContainer = this.modalEl;
    if (!modalContainer || !this.options.size) return;

    this.clearModalSizeStyles();

    const size = this.options.size;
    modalContainer.classList.add(`aoc-modal-size-${size}`);

    const dimensions = MODAL_SIZE_DIMENSIONS[size];
    const { width, minWidth, maxWidth } = dimensions;
    modalContainer.style.setProperty('width', width, MODAL_SHELL_STYLE_PRIORITY);
    modalContainer.style.setProperty('min-width', minWidth, MODAL_SHELL_STYLE_PRIORITY);
    if (maxWidth) {
      modalContainer.style.setProperty('max-width', maxWidth, MODAL_SHELL_STYLE_PRIORITY);
    }
  }

  protected clearModalSizeStyles(): void {
    const modalContainer = this.modalEl;
    if (!modalContainer) return;

    modalContainer.classList.remove(
      'aoc-modal-size-small',
      'aoc-modal-size-medium',
      'aoc-modal-size-large',
      'aoc-modal-size-mobile'
    );
    modalContainer.style.removeProperty('width');
    modalContainer.style.removeProperty('min-width');
    modalContainer.style.removeProperty('max-width');
    modalContainer.style.removeProperty('margin');
    modalContainer.style.removeProperty('border-radius');
    modalContainer.style.removeProperty('max-height');
    modalContainer.style.removeProperty('height');
  }

  protected createTitle(): void {
    if (!this.options.title) return;

    if (this.options.titleIcon) {
      const titleContainer = this.contentEl.createEl('div', {
        cls: 'aoc-modal-title-container',
      });
      const titleIcon = titleContainer.createEl('span', {
        cls: 'aoc-modal-title-icon',
      });
      titleIcon.textContent = this.options.titleIcon;
      titleContainer.createEl('h2', {
        text: this.options.title,
        cls: 'aoc-modal-title',
      });
    } else {
      this.contentEl.createEl('h2', {
        text: this.options.title,
        cls: 'aoc-modal-title',
      });
    }
  }

  protected setupAutoFocus(): void {
    if (!this.options.autoFocus || !this.options.focusSelector) return;

    window.setTimeout(() => {
      const focusElement = this.contentEl.querySelector(
        this.options.focusSelector!
      ) as HTMLElement;
      if (focusElement && typeof focusElement.focus === 'function') {
        focusElement.focus();
        this.resetScrollPosition();
      }
    }, 10);
  }

  protected createButtonContainer(
    container: HTMLElement,
    cssClass = 'aoc-modal-button-container'
  ): HTMLElement {
    return container.createEl('div', { cls: cssClass });
  }

  protected createButton(
    container: HTMLElement,
    text: string,
    onClick: () => void,
    options: {
      isPrimary?: boolean;
      isWarning?: boolean;
      icon?: string;
      tooltip?: string;
    } = {}
  ): HTMLButtonElement {
    const button = container.createEl('button', { text, cls: 'mod-button' });
    if (options.isPrimary) button.addClass('mod-cta');
    if (options.isWarning) button.addClass('mod-warning');
    if (options.icon) {
      button.empty();
      setIcon(button, options.icon);
    }
    if (options.tooltip) {
      button.setAttr('aria-label', options.tooltip);
    }
    button.addEventListener('click', onClick);
    return button;
  }

  protected createSection(
    container: HTMLElement,
    cssClass = 'aoc-modal-section'
  ): HTMLElement {
    return container.createEl('div', { cls: cssClass });
  }

  protected abstract createContent(): void;
}
