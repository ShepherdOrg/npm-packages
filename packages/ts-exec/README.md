# TS Exec

Promise based convenience wrapper around child_process.ExecFile. Emphasis on testability, so it comes with a convenient
test double, enabling you to unit test your CLI controlling programs.

Optional collection of stdout/stderr process outputs to be returned with the promise result.

Option to provide string to be written to stdin of the child process.

See the [specs](./src/exec.spec.ts) for example usage.
