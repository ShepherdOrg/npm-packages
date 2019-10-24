describe('logger', function () {
    it('should log nicely', function () {
        let logger = require('./logger')('testTheLogger');
        logger.info('Testing the logger');
    });

});