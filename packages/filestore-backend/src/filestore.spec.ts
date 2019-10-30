import path from "path"
import testBackend from "@shepherdorg/storage-backend-tester"
import { FileStore } from "."

testBackend("File object", () => FileStore({ directory: path.join(__dirname, ".teststore") }))
