# Flooow 🌊

Simple yet powerful video scrubbing library for smooth frame-by-frame playback control!

## ✨ Features

- 🎯 Frame-perfect video scrubbing
- 🚀 WebCodecs support for optimal performance
- 🎨 Canvas-based rendering
- 📱 Safari compatibility
- 🔄 Smooth transitions between frames
- 🎮 Progress-based playback control

## 🛠️ Installation

```bash
npm install flooow
```

## 🚀 Quick Start

```javascript
import Flooow from 'flooow'

const video = new Flooow({
  src: 'path/to/video.mp4',
  wrapper: '#video-container',
  debug: false,
  useWebCodec: true
})

// Control video progress (0-1)
video.setVideoProgress(0.5) // Jump to middle
```

## 📖 Usage

### Vanilla JavaScript

```javascript
const wrapper = document.querySelector('#video-wrapper')

const flooow = new Flooow({
  src: '/path/to/video.mp4',
  wrapper: wrapper,
  debug: true,
  useWebCodec: true
})

// Control video progress with mouse movement
wrapper.addEventListener('mousemove', (event) => {
  const mouseX = event.clientX
  const width = wrapper.clientWidth
  flooow.setVideoProgress(mouseX / width)
})
```

### React

```jsx
import { useEffect, useRef } from 'react'
import Flooow from 'flooow'

function VideoScrubber() {
  const wrapperRef = useRef(null)
  const flooowRef = useRef(null)

  useEffect(() => {
    if (!wrapperRef.current) return

    flooowRef.current = new Flooow({
      src: '/path/to/video.mp4',
      wrapper: wrapperRef.current,
      useWebCodec: true,
      onReady: () => console.log('Video ready!')
    })

    return () => {
      if (flooowRef.current) {
        flooowRef.current.destroy()
      }
    }
  }, [])

  const handleScroll = () => {
    const scrollProgress = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)
    flooowRef.current?.setVideoProgress(scrollProgress)
  }

  useEffect(() => {
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return <div ref={wrapperRef} style={{ height: '100vh' }} />
}
```

### Vue

```vue
<template>
  <div ref="wrapper" class="video-wrapper" @mousemove="handleMouseMove"></div>
</template>

<script>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import Flooow from 'flooow'

export default {
  setup() {
    const wrapper = ref(null)
    let flooow = null

    onMounted(() => {
      flooow = new Flooow({
        src: '/path/to/video.mp4',
        wrapper: wrapper.value,
        useWebCodec: true,
        onReady: () => console.log('Video ready!')
      })
    })

    const handleMouseMove = (event) => {
      if (!flooow) return

      const rect = wrapper.value.getBoundingClientRect()
      const x = event.clientX - rect.left
      flooow.setVideoProgress(x / rect.width)
    }

    onBeforeUnmount(() => {
      if (flooow) {
        flooow.destroy()
      }
    })

    return {
      wrapper,
      handleMouseMove
    }
  }
}
</script>

<style>
.video-wrapper {
  width: 100%;
  height: 100vh;
}
</style>
```

## 🔧 Dependencies

- [ua-parser-js](https://docs.uaparser.dev/) - Browser detection
- [mp4box](https://github.com/gpac/mp4box.js) - MP4 parsing

## ⚠️ Browser Support

Works best in modern browsers with WebCodecs support. Falls back gracefully in other browsers.

---

Inspired by [ScrollyVideo.js](https://scrollyvideo.js.org) 💡
