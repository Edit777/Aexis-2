if (!customElements.get('media-gallery')) {
  customElements.define(
    'media-gallery',
    class MediaGallery extends HTMLElement {
      constructor() {
        super();
        this.elements = {
          liveRegion: this.querySelector('[id^="GalleryStatus"]'),
          viewer: this.querySelector('[id^="GalleryViewer"]'),
          thumbnails: this.querySelector('[id^="GalleryThumbnails"]'),
        };
        this.mql = window.matchMedia('(min-width: 750px)');
        this.isVerticalThumbnailDesktop =
          this.elements.thumbnails?.dataset.thumbnailSliderOrientation === 'vertical';
        if (!this.elements.thumbnails) return;

        this.elements.viewer.addEventListener('slideChanged', debounce(this.onSlideChanged.bind(this), 500));
        this.elements.thumbnails.querySelectorAll('[data-target]').forEach((mediaToSwitch) => {
          mediaToSwitch
            .querySelector('button')
            .addEventListener('click', this.setActiveMedia.bind(this, mediaToSwitch.dataset.target, false));
        });
        if (this.isVerticalThumbnailDesktop) {
          this.thumbnailList = this.elements.thumbnails.querySelector('[id^="Slider-"]');
          this.verticalPrevButton = this.elements.thumbnails.querySelector('button[name="previous"]');
          this.verticalNextButton = this.elements.thumbnails.querySelector('button[name="next"]');
          this.verticalStep = Number(this.verticalNextButton?.dataset.step || 1);
          this.verticalPrevButton?.addEventListener('click', this.onVerticalThumbnailButtonClick.bind(this));
          this.verticalNextButton?.addEventListener('click', this.onVerticalThumbnailButtonClick.bind(this));
          this.thumbnailList?.addEventListener('scroll', debounce(this.updateVerticalThumbnailButtons.bind(this), 100));
          this.updateVerticalThumbnailButtons();
        }
        if (this.dataset.desktopLayout.includes('thumbnail') && this.mql.matches) this.removeListSemantic();

        this.initializeMobileLayoutRefresh();
      }

      initializeMobileLayoutRefresh() {
        if (!this.elements.viewer?.slider || typeof ResizeObserver === 'undefined') return;
        const refreshSliderPages = debounce(() => {
          if (this.mql.matches || !this.elements.viewer?.slider) return;
          this.elements.viewer.resetPages();
        }, 150);
        this.mobileLayoutObserver = new ResizeObserver(() => refreshSliderPages());
        this.mobileLayoutObserver.observe(this.elements.viewer);
      }

      disconnectedCallback() {
        this.mobileLayoutObserver?.disconnect();
      }

      onSlideChanged(event) {
        const thumbnail = this.elements.thumbnails.querySelector(
          `[data-target="${event.detail.currentElement.dataset.mediaId}"]`
        );
        this.setActiveThumbnail(thumbnail);
      }

      setActiveMedia(mediaId, prepend) {
        const activeMedia =
          this.elements.viewer.querySelector(`[data-media-id="${mediaId}"]`) ||
          this.elements.viewer.querySelector('[data-media-id]');
        if (!activeMedia) {
          return;
        }
        this.elements.viewer.querySelectorAll('[data-media-id]').forEach((element) => {
          element.classList.remove('is-active');
        });
        activeMedia?.classList?.add('is-active');

        if (prepend) {
          activeMedia.parentElement.firstChild !== activeMedia && activeMedia.parentElement.prepend(activeMedia);

          if (this.elements.thumbnails) {
            const activeThumbnail = this.elements.thumbnails.querySelector(`[data-target="${mediaId}"]`);
            activeThumbnail.parentElement.firstChild !== activeThumbnail && activeThumbnail.parentElement.prepend(activeThumbnail);
          }

          if (this.elements.viewer.slider) this.elements.viewer.resetPages();
        }

        this.preventStickyHeader();
        window.setTimeout(() => {
          if (!this.mql.matches || this.elements.thumbnails) {
            activeMedia.parentElement.scrollTo({ left: activeMedia.offsetLeft });
          }
          const activeMediaRect = activeMedia.getBoundingClientRect();
          // Don't scroll if the image is already in view
          if (activeMediaRect.top > -0.5) return;
          const top = activeMediaRect.top + window.scrollY;
          window.scrollTo({ top: top, behavior: 'smooth' });
        });
        this.playActiveMedia(activeMedia);

        if (!this.elements.thumbnails) return;
        const activeThumbnail = this.elements.thumbnails.querySelector(`[data-target="${mediaId}"]`);
        this.setActiveThumbnail(activeThumbnail);
        this.announceLiveRegion(activeMedia, activeThumbnail.dataset.mediaPosition);
      }

      setActiveThumbnail(thumbnail) {
        if (!this.elements.thumbnails || !thumbnail) return;

        this.elements.thumbnails
          .querySelectorAll('button')
          .forEach((element) => element.removeAttribute('aria-current'));
        thumbnail.querySelector('button').setAttribute('aria-current', true);
        if (this.isVerticalThumbnailDesktop && this.mql.matches && this.thumbnailList) {
          this.thumbnailList.scrollTo({ top: thumbnail.offsetTop });
          this.updateVerticalThumbnailButtons();
          return;
        }

        if (this.elements.thumbnails.isSlideVisible(thumbnail, 10)) return;

        this.elements.thumbnails.slider.scrollTo({ left: thumbnail.offsetLeft });
      }

      onVerticalThumbnailButtonClick(event) {
        event.preventDefault();
        if (!this.mql.matches || !this.thumbnailList) return;

        const direction = event.currentTarget.name === 'next' ? 1 : -1;
        const firstVisibleThumbnail = this.thumbnailList.querySelector('[id^="Slide-"]');
        const itemHeight = firstVisibleThumbnail?.clientHeight || 0;
        const thumbnailGap = 10;
        const scrollStep = (itemHeight + thumbnailGap) * this.verticalStep;

        this.thumbnailList.scrollBy({ top: direction * scrollStep });
        window.setTimeout(() => this.updateVerticalThumbnailButtons(), 150);
      }

      updateVerticalThumbnailButtons() {
        if (!this.mql.matches || !this.thumbnailList) return;

        const maxScrollTop = this.thumbnailList.scrollHeight - this.thumbnailList.clientHeight;
        if (this.verticalPrevButton) {
          if (this.thumbnailList.scrollTop <= 0) {
            this.verticalPrevButton.setAttribute('disabled', 'disabled');
          } else {
            this.verticalPrevButton.removeAttribute('disabled');
          }
        }

        if (this.verticalNextButton) {
          if (this.thumbnailList.scrollTop >= maxScrollTop - 1) {
            this.verticalNextButton.setAttribute('disabled', 'disabled');
          } else {
            this.verticalNextButton.removeAttribute('disabled');
          }
        }
      }

      announceLiveRegion(activeItem, position) {
        const image = activeItem.querySelector('.product__modal-opener--image img');
        if (!image) return;
        image.onload = () => {
          this.elements.liveRegion.setAttribute('aria-hidden', false);
          this.elements.liveRegion.innerHTML = window.accessibilityStrings.imageAvailable.replace('[index]', position);
          setTimeout(() => {
            this.elements.liveRegion.setAttribute('aria-hidden', true);
          }, 2000);
        };
        image.src = image.src;
      }

      playActiveMedia(activeItem) {
        window.pauseAllMedia();
        const deferredMedia = activeItem.querySelector('.deferred-media');
        if (deferredMedia) deferredMedia.loadContent(false);
      }

      preventStickyHeader() {
        this.stickyHeader = this.stickyHeader || document.querySelector('sticky-header');
        if (!this.stickyHeader) return;
        this.stickyHeader.dispatchEvent(new Event('preventHeaderReveal'));
      }

      removeListSemantic() {
        if (!this.elements.viewer.slider) return;
        this.elements.viewer.slider.setAttribute('role', 'presentation');
        this.elements.viewer.sliderItems.forEach((slide) => slide.setAttribute('role', 'presentation'));
      }
    }
  );
}
