/* eslint-disable no-console */

export const logStuff = (stuff: string, isError?: boolean) => {
  if (isError) {
    console.error('Flooow:', stuff)
  } else {
    console.log('Flooow:', stuff)
  }
}
