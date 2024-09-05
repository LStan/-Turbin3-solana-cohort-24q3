pragma circom 2.1.9;

include "../../node_modules/circomlib/circuits/poseidon.circom";

template SymmetricEncrypt(length) {
    signal input message[length];  // private
    signal input key;  // private
    signal input nonce;  // public

    signal output encryptedMessage[length + 1];

    component hashers[length + 1];
    hashers[0] = PoseidonEx(2, 2);
    hashers[0].initialState <== 0;
    hashers[0].inputs[0] <== key;
    hashers[0].inputs[1] <== nonce;

    for (var i = 0; i < length; i++) {
        encryptedMessage[i] <== hashers[i].out[1] + message[i];
        hashers[i + 1] = PoseidonEx(1, 2);
        hashers[i + 1].initialState <== hashers[i].out[0];
        hashers[i + 1].inputs[0] <== encryptedMessage[i];
    }

    encryptedMessage[length] <== hashers[length].out[1];
}

template Proof(length) {
    // private
    signal input message[length];
    signal input key;
    // public
    signal input nonce;
    signal input messageHash;
    signal input keyHash;
    signal output encryptedMessage[length + 1];

    component encrypt;
    encrypt = SymmetricEncrypt(length);

    for (var i = 0; i < length; i++) {
        encrypt.message[i] <== message[i];
    }

    encrypt.key <== key;
    encrypt.nonce <== nonce;
    for (var i = 0; i < length + 1; i++) {
        encryptedMessage[i] <== encrypt.encryptedMessage[i];
    }

    component hasherMessage;
    hasherMessage = PoseidonEx(length, 2);
    hasherMessage.initialState <== 0;
    for (var i = 0; i < length; i++) {
        hasherMessage.inputs[i] <== message[i];
    }
    messageHash === hasherMessage.out[1];

    component hasherKey;
    hasherKey = PoseidonEx(1, 2);
    hasherKey.initialState <== 0;
    hasherKey.inputs[0] <== key;

    keyHash === hasherKey.out[1];

}

component main {public [nonce, messageHash, keyHash]} = Proof(10);
