const speakeasy = require('speakeasy');

// Generate a secret key with a length
// of 20 characters
const secret = speakeasy.generateSecret({ length: 4 });

// Generate a TOTP code using the secret key
const code = speakeasy.totp({

    // Use the Base32 encoding of the secret key
    secret: secret.base32,

    // Tell Speakeasy to use the Base32 
    // encoding format for the secret key
    encoding: 'base32'
});

console.log('code',code)