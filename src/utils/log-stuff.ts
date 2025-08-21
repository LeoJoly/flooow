/* eslint-disable no-console */

export const logStuff = (stuff: string, isError?: boolean, isWarning?: boolean) => {
  if (isError) {
    console.error('Flooow:', stuff)
  } else if (isWarning) {
    console.warn('Flooow:', stuff)
  } else {
    console.log('Flooow:', stuff)
  }
}
