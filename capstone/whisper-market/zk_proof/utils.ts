import { ZqField, buildBn128, utils } from "ffjavascript";
import { buildPoseidon } from "circomlibjs";
import { wasm } from "circom_tester";
import { assert } from "chai";
import * as snarkjs from "snarkjs";
import * as fs from "fs";
import { convertPublicKey, convertSecretKey } from "ed2curve";
import { scalarMult, sign } from "tweetnacl";

const SNARK_FIELD_SIZE =
  "21888242871839275222246405745257275088548364400416034343698204186575808495617";
const F = new ZqField(SNARK_FIELD_SIZE);

function stringToBinary(str) {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(str);
  return Array.from(encoded)
    .map((byte) => byte.toString(2).padStart(8, "0"))
    .join("");
}

function binaryToString(binary: string) {
  binary = binary.padStart(binary.length + (8 - (binary.length % 8)), "0");
  assert(binary.length % 8 === 0);
  const decoder = new TextDecoder();
  const decoded = decoder.decode(
    new Uint8Array(binary.match(/.{1,8}/g).map((byte) => parseInt(byte, 2)))
  );
  return decoded;
}

function binaryStringToBigIntArray(binaryString, chunkSize, num) {
  assert(binaryString.length <= num * chunkSize);

  binaryString = binaryString.padStart(num * chunkSize, "0");

  const chunks = [];
  for (let i = 0; i < binaryString.length; i += chunkSize) {
    chunks.push(binaryString.slice(i, i + chunkSize));
  }
  return chunks.map((chunk) => BigInt(`0b${chunk}`));
}

function bigIntArrayToBinaryString(bigIntArray, bitsNum) {
  let res: string = bigIntArray
    .map((bigInt) => bigInt.toString(2).padStart(bitsNum, "0"))
    .join("");

  // find first non-zero bit
  let i = 0;
  while (res[i] === "0") {
    i++;
  }

  //   remove leading zeros
  res = res.slice(i);
  return res;
}

async function poseidonEncrypt(message: bigint[], key: bigint, nonce: bigint) {
  const poseidonEx = await buildPoseidon();

  let state = [F.zero, F.e(key), F.e(nonce)];
  const ciphertext: bigint[] = [];

  for (let i = 0; i < message.length; i++) {
    state = poseidonEx(state.slice(1), state[0], 2).map((x) =>
      poseidonEx.F.toObject(x)
    );

    state[1] = F.add(state[1], message[i]);
    ciphertext.push(state[1]);
  }

  return ciphertext;
}

function to32ByteBuffer(bigInt) {
  const hexString = bigInt.toString(16).padStart(64, "0");
  const buffer = Buffer.from(hexString, "hex");
  return buffer;
}

function from32ByteBuffer(buffer: Buffer) {
  assert(buffer.length === 32);
  const hexString = buffer.toString("hex");
  const bigInt = BigInt(`0x${hexString}`);
  return bigInt;
}

async function poseidonDecrypt(
  ciphertext: bigint[],
  key: bigint,
  nonce: bigint
) {
  const poseidonEx = await buildPoseidon();
  let state = [F.zero, F.e(key), F.e(nonce)];
  const message: bigint[] = [];

  for (let i = 0; i < ciphertext.length; i++) {
    state = poseidonEx(state.slice(1), state[0], 2).map((x) =>
      poseidonEx.F.toObject(x)
    );
    message.push(F.sub(ciphertext[i], state[1]));
    state[1] = ciphertext[i];
  }
  return message;
}

async function hashMessage(message: bigint[]) {
  const poseidonEx = await buildPoseidon();
  return poseidonEx(message, F.zero, 2).map((x) => poseidonEx.F.toObject(x))[1];
}

async function hashKey(key: bigint) {
  const poseidonEx = await buildPoseidon();
  return poseidonEx([key], F.zero, 2).map((x) => poseidonEx.F.toObject(x))[1];
}

function g1Uncompressed(curve, p1Raw) {
  let p1 = curve.G1.fromObject(p1Raw);

  let buff = new Uint8Array(64); // 64 bytes for G1 uncompressed
  curve.G1.toRprUncompressed(buff, 0, p1);

  return Buffer.from(buff);
}

function g2Uncompressed(curve, p2Raw) {
  let p2 = curve.G2.fromObject(p2Raw);

  let buff = new Uint8Array(128); // 128 bytes for G2 uncompressed
  curve.G2.toRprUncompressed(buff, 0, p2);

  return Buffer.from(buff);
}

function sharedSecretFromEd25519Keys(
  secretKey: Uint8Array,
  publicKey: Uint8Array
): bigint {
  const X25519Secret = convertSecretKey(secretKey);
  const X25519Pubkey = convertPublicKey(publicKey)!;
  const sharedSecret = scalarMult(X25519Secret, X25519Pubkey);
  const sharedSecretBigInt =
    from32ByteBuffer(Buffer.from(sharedSecret)) % BigInt(SNARK_FIELD_SIZE);

  return sharedSecretBigInt;
}

function generateNonce() {
  return BigInt(Math.floor(Math.random() * Math.pow(2, 64)));
}

async function generateProof(
  message: String,
  key: bigint,
  nonceBuffer: Buffer
) {
  const MAX_SYMBOLS = 10;
  const nonce = from32ByteBuffer(nonceBuffer);
  const binaryMessage = stringToBinary(message);
  const bigIntArrayMessage = binaryStringToBigIntArray(
    binaryMessage,
    253,
    MAX_SYMBOLS
  );

  const proofInput = {
    message: bigIntArrayMessage,
    key,
    nonce,
  };

  const wasmPath = __dirname + "/circom/proof_js/proof.wasm";
  const zkeyPath = __dirname + "/circom/proof_final.zkey";
  let { proof, publicSignals } = await snarkjs.groth16.fullProve(
    proofInput,
    wasmPath,
    zkeyPath
  );

  const curve = await buildBn128();

  proof = utils.unstringifyBigInts(proof);
  let pi_a_temp = curve.G1.fromObject(proof.pi_a);
  pi_a_temp = curve.G1.neg(pi_a_temp);
  proof.pi_a = curve.G1.toObject(pi_a_temp);

  const pi_a = g1Uncompressed(curve, proof.pi_a);
  const pi_b = g2Uncompressed(curve, proof.pi_b);
  const pi_c = g1Uncompressed(curve, proof.pi_c);

  let proofFull = Buffer.concat([pi_a, pi_b, pi_c]);

  publicSignals = utils.unstringifyBigInts(publicSignals);

  const encryptedMessage = Buffer.concat(
    publicSignals.slice(2, 12).map((b) => to32ByteBuffer(b))
  );
  return { proof: proofFull, encryptedMessage };
}

async function decryptMessage(
  encryptedMessageBuffer: Buffer,
  key: bigint,
  nonceBuffer: Buffer
) {
  const nonce = from32ByteBuffer(nonceBuffer);

  // split encryptedMessageBuffer into chunks of 32 bytes
  const chunks = [];
  for (let i = 0; i < encryptedMessageBuffer.length; i += 32) {
    chunks.push(encryptedMessageBuffer.subarray(i, i + 32));
  }

  const bigIntArrayMessage = chunks.map((chunk) =>
    // BigInt(`0x${chunk.toString("hex")}`)
    from32ByteBuffer(chunk)
  );

  const decryptedMessage = await poseidonDecrypt(bigIntArrayMessage, key, nonce);

  const decryptedBits = bigIntArrayToBinaryString(decryptedMessage, 253);
  const decryptedMessageString = binaryToString(decryptedBits);

  return decryptedMessageString;
}

async function fullPathTest() {
  const MAX_SYMBOLS = 10;

  const message = "Hello, World!";
  const key = BigInt(5);
  const nonce = BigInt(77);

  const binary = stringToBinary(message);
  //   console.log(binary);

  const bigIntArrayMessage = binaryStringToBigIntArray(
    binary,
    253,
    MAX_SYMBOLS
  );
  const encryptedMessage = await poseidonEncrypt(
    bigIntArrayMessage,
    key,
    nonce
  );
  //   const encryptedMessage = bigIntArray;
  //   console.log(encryptedMessage.length);

  const messageHash = await hashMessage(bigIntArrayMessage);
  const keyHash = await hashKey(key);

  console.log("Starting proof");

  const proofInput = {
    message: bigIntArrayMessage,
    key,
    nonce,
  };
  {
    const wasmPath = __dirname + "/circom/proof_js/proof.wasm";
    const zkeyPath = __dirname + "/circom/proof_final.zkey";
    let { proof, publicSignals } = await snarkjs.groth16.fullProve(
      proofInput,
      wasmPath,
      zkeyPath
    );

    const curve = await buildBn128();

    const vKey = JSON.parse(
      fs.readFileSync(__dirname + "/circom/verification_key.json").toString()
    );
    // console.log(vKey);

    let pi_a_temp = curve.G1.fromObject(utils.unstringifyBigInts(proof.pi_a));
    console.log(proof.pi_a);
    pi_a_temp = curve.G1.neg(pi_a_temp);

    console.log(pi_a_temp);
    pi_a_temp = utils.stringifyBigInts(curve.G1.toObject(pi_a_temp));
    console.log(pi_a_temp);

    proof.pi_a = pi_a_temp;

    // const logger = {
    //   info: (msg) => console.log(`INFO: ${msg}`),
    //   error: (msg) => console.log(`ERROR: ${msg}`),
    //   debug: (msg) => console.log(`DEBUG: ${msg}`),
    //   verbose: (msg) => console.log(`VERBOSE: ${msg}`),
    // };

    // return;

    const res = await snarkjs.groth16.verify(vKey, publicSignals, proof);

    if (res === true) {
      console.log("Verification OK");
    } else {
      console.log("Invalid proof");
    }

    const proofProc = utils.unstringifyBigInts(proof);
    publicSignals = utils.unstringifyBigInts(publicSignals);

    let pi_a = g1Uncompressed(curve, proofProc.pi_a);
    let pi_a_0_u8_array = Array.from(pi_a);
    console.log(pi_a_0_u8_array);

    const pi_b = g2Uncompressed(curve, proofProc.pi_b);
    let pi_b_0_u8_array = Array.from(pi_b);
    console.log(pi_b_0_u8_array.slice(0, 64));
    console.log(pi_b_0_u8_array.slice(64, 128));

    const pi_c = g1Uncompressed(curve, proofProc.pi_c);
    let pi_c_0_u8_array = Array.from(pi_c);
    console.log(pi_c_0_u8_array);

    // console.log(proof);
    console.log(publicSignals);
    console.log(encryptedMessage);
    console.log(messageHash);
    console.log(keyHash);
    // console.log(to32ByteBuffer(nonce));
    // console.log(Array.from(to32ByteBuffer(nonce)));
    // console.log("nonce: ", from32ByteBuffer(to32ByteBuffer(nonce)));

    const encryptedMessageBuffer = Buffer.concat(
      encryptedMessage.map((b) => to32ByteBuffer(b))
    );
    // console.log(encryptedMessageBuffer);
    // console.log(JSON.stringify(Array.from(encryptedMessageBuffer)));

    const serializedData = Buffer.concat([pi_a, pi_b, pi_c]);

    console.log(JSON.stringify(Array.from(serializedData)));
  }

  // const circuit = await wasm("./zk_proof/circom/proof.circom");
  const circuit = await wasm(__dirname + "/circom/proof.circom");
  const witness = await circuit.calculateWitness(proofInput);
  await circuit.checkConstraints(witness);

  await circuit.loadSymbols();
  const encryptedMessageCircuit: bigint[] = [];
  for (let i = 0; i < bigIntArrayMessage.length; i++) {
    const out =
      witness[circuit.symbols["main.encryptedMessage[" + i + "]"].varIdx];
    encryptedMessageCircuit.push(out);
  }
  // console.log(encryptedMessageCircuit);
  // console.log(encryptedMessage);
  assert(encryptedMessageCircuit.length === encryptedMessage.length);

  for (let i = 0; i < encryptedMessageCircuit.length; i++) {
    assert(encryptedMessageCircuit[i] === encryptedMessage[i]);
  }

  const messageHashCircuit =
    witness[circuit.symbols["main.messageHash"].varIdx];
  const keyHashCircuit = witness[circuit.symbols["main.keyHash"].varIdx];
  assert(messageHashCircuit === messageHash);
  assert(keyHashCircuit === keyHash);

  console.log("Proof checked");

  const encryptedBits = bigIntArrayToBinaryString(encryptedMessage, 256);
  //   console.log(encryptedBits);

  const encryptedBytes = binaryStringToBigIntArray(
    encryptedBits,
    8,
    Math.ceil(encryptedBits.length / 8)
  );

  const encryptedBitsReturned = bigIntArrayToBinaryString(encryptedBytes, 8);
  //   console.log(encryptedBits === encryptedBitsReturned);
  //   console.log(encryptedBits.length);

  const encryptedMessageReturned = binaryStringToBigIntArray(
    encryptedBitsReturned,
    256,
    MAX_SYMBOLS
  );

  const decryptedMessage = await poseidonDecrypt(
    encryptedMessageReturned,
    key,
    nonce
  );
  //   const decryptedMessage = encryptedMessageReturned;
  const decryptedBits = bigIntArrayToBinaryString(decryptedMessage, 253);
  const decryptedMessageFinal = binaryToString(decryptedBits);
  //   console.log(decryptedMessageFinal);

  assert(decryptedMessageFinal === message);

  console.log("Message decrypted successfully");
}

function test2() {
  const alice = sign.keyPair();
  const bob = sign.keyPair();

  const sharedSecretBigInt = sharedSecretFromEd25519Keys(
    alice.secretKey,
    bob.publicKey
  );

  console.log(sharedSecretBigInt);

  console.log(sharedSecretFromEd25519Keys(bob.secretKey, alice.publicKey));

  console.log(generateNonce());
}

// fullPathTest().then(() => {
//   process.exit(0);
// });

// test2();

generateProof("Hello, World!", BigInt(5), to32ByteBuffer(BigInt(77))).then(
  (a) => {
    console.log(JSON.stringify(a));
    decryptMessage(a.encryptedMessage, BigInt(5), to32ByteBuffer(BigInt(77))).then(
      (b) => {
        console.log(b);
        process.exit(0);
      }
    );

  }
);

export { bigIntArrayToBinaryString, binaryStringToBigIntArray };
