import Flooow from '@/index'

const $wrapper = document.querySelector('#video-wrapper')

if ($wrapper) {
  const flooow = new Flooow({
    debug: true,
    src: 'https://videos.pexels.com/video-files/2313698/2313698-uhd_2560_1440_25fps.mp4',
    useWebCodec: true,
    wrapper: $wrapper
  })

  $wrapper.addEventListener('mousemove', (event) => {
    const mouseX = (event as MouseEvent).clientX
    const width = $wrapper.clientWidth

    flooow.setVideoProgress(mouseX / width)
  })
}
