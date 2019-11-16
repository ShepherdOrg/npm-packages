export const options= {
  testRunMode: () => {
    return process.env.TESTRUN_MODE === "true" || false
  },
}
