const untarString = require('./untar-string');
const expect = require('chai').expect

const base64EncodedTar = 'H4sIAEZiQloAA+1XTXPiOBDlzK9QpXLaKoFtDEz5RhLPrmvCRwEzmRsl7A5Rxba8sgyhsvnvK9t8\n' +
    'GBsCSSbJTq3fBSy1XkvqVuupVncgcNnSA1/UK+8DRaLdbsa/arupZn/XqKgNTW21G0qrqVcUVdM1\n' +
    'pYKa7zSfHUShIByhyixyXfqM3bH+3xS1bPwXiwWmNrjEdwjl2GZebdtbW3ru63zEAW619EPxbzR0\n' +
    'bTf+mqqozQpSfu1S9+N/Hn8S0B/AQ8p8A8GDAD/+G9bn6hQEUav31HcMdLVJgqonmx0iiFFFyCce\n' +
    'GKiYNLLLJVNww9joWTOEBAVuoFvOfOnbqYYB2PEoLj1Sm4QG0uSXAC9wiYCULzuFGFlfR/3t8Rk3\n' +
    'rf3GoB6ZwUCGewQ2B5Fhxituh9n3wDGHGQ0FX+JAGuMwsV7Z2pKbUF/ubHZ0wmyg88fx4Hpy1b/8\n' +
    'Zg4nVrfzp/m0MTph+vHuhCziNmTIk42gHhW5NjmVIDKQUvuSa/bAY3xpoKaqdXe6OPwdQXiQRz/A\n' +
    'ozVbWZ6A8TwF3u7KQPYa6Iua40qXfidEgAPOHpa5btkmmM1cA40vB89T63p+nlvu8EXkc+ZGHnRZ\n' +
    '5BfXk3JuwyQzMcQ2yJXnyDkQp++7cpsEjyC/gzH3gIg7A53Vk9H1XcqzvW79GfUfMLHd1zsDYdcT\n' +
    'mnpMU8/6AX++f7XD772x1TUnZu+HNez3umZvnHMxJ24EXznz8hmUHItbOuuS4Bssh3BbNFjH6fzR\n' +
    '/DnoD8fq0x6Te5Brk/6LJyt7piaj0fCEY4XDkL/xaLU+7mil2binJB1JwrQ47fpN23rJ8PgSxHkO\n' +
    'uTkxD72VlVhAweXeBNxEeNfXwd0/kMVUlvzCNuE08os72evKyltIjSDJ601/LZ5M9bNv2P82jum/\n' +
    'EPhcNr1e/FWO6j9Nfub0n6JJ81L/fQCy+m++1nujNOinij3i+0wQEQtHA6VyapU1sYis3UdT4D4I\n' +
    'CGuU1ckixC4jDp4SySLrS3ob4+39e/bH2UsUZBhNHebJuz++NUbfL6Sw6nas3mQwNL9aP5/iKaRK\n' +
    'kwVbu7TTvJqM+4P1gF6nuxJiAognBaJLg40gFctATuFaTvxiNe9qRuTg5K9UNEo6nvAZiB2Rk5c2\n' +
    'm/VmRut6ozB8LWQK8iVLEIILtmD85XobY1z91SlQZsDvlAGfXYBKfCqO3P+YyizhPnHfIgSO3P9K\n' +
    'Q2/m7n9NVdrl/f8ReHPx32TIiRV7a78urIUaqsZJkat5ZY17HxzT/+l77k3y/+j5l+/bvP5XlUZ5\n' +
    '/j8Ce8//5foRf1oF2HnDZ2tARkWtSTaPcwP9gxOj88cLEkJLvwKbOWDc3NxMrEvzutO76ljDiTWY\n' +
    '3Pxljc1razR+Kg9yiRIlSpQoUaJEiRIlSrwa/wJ4qk95ACgAAA==';

describe('untar base64 encoded string archive', function () {
    it('should untar string and return object with expanded directory structure', function () {
        return untarString(base64EncodedTar).then(function (dirStructure) {
            expect(dirStructure['./deployment/www-icelandair-com.deployment.yml']).to.be.a('object');
            expect(dirStructure['./deployment/www-icelandair-com.deployment.yml'].content).to.contain('name: www-icelandair-com');
        })
    });
});
