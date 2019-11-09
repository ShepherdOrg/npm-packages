before(() => {
  process.env.ENV = "testenv"
})

after(() => {
  delete process.env.ENV
})


testDebug = console.log
