// Modules you want available in the global namespace. Be EXTREMELY conservative on what you put
// here. Only frequently used, low-level libraries which do NOT handle IO should be available in global namespace,
// the purpose being to decrease verbosity of code where those libraries are used.

global._ = require("lodash")

global.inject = require("@shepherdorg/nano-inject")

Path = require("path")
