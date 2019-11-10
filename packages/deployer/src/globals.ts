// Modules you want available in the global namespace. Be EXTREMELY conservative on what you put
// here. Only frequently used, low-level libraries which do NOT handle IO should be available in global namespace,
// the purpose being to decrease verbosity of code where those libraries are used.

// @ts-ignore
global._ = require("lodash")

// @ts-ignore
global.inject = require("@shepherdorg/nano-inject")

