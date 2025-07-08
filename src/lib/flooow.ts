import { logError } from '@/utils/log-error'

type FlooowOptions = {
  src: string
  wrapper: Element | string
}

class Flooow {
  src!: string
  video!: HTMLVideoElement
  wrapper!: Element

  constructor({ src, wrapper }: FlooowOptions) {
    // Make sure we have a DOM
    if (typeof document !== 'object') {
      logError('Flooow instance must be created in a DOM environment')
      return
    }

    // Check basic arguments
    if (!wrapper) {
      logError('"wrapper" must be a valid HTML Element')
      return
    }

    if (!src) {
      logError('"src" property must be set')
      return
    }

    // Strore the wrapper
    // if it a HTMLElement we store it directly
    if (wrapper instanceof Element) {
      this.wrapper = wrapper
    } else if (typeof wrapper === 'string') {
      // if it's a string we search for it in the DOM
      const wrapperElement = document.querySelector(wrapper)
      if (!wrapperElement) {
        logError('wrapper not found in the DOM')
        return
      }

      this.wrapper = wrapperElement
    }

    // Store options
    this.src = src

    // Create a base video element to be displayed at the begenning
    this.video = document.createElement('video')
    this.video.classList.add('flooow-video')
    this.video.src = this.src
    this.video.controls = false
    this.video.autoplay = true
    this.video.loop = true
    this.video.muted = true
    this.video.playsInline = true
    this.video.preload = 'auto'
    this.video.tabIndex = 0

    this.video.load()
    this.video.pause()

    // Insert the video in the wrapper
    this.wrapper.appendChild(this.video)
  }
}

export default Flooow
