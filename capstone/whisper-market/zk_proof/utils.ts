import { ZqField, buildBn128, utils } from "ffjavascript";
import { buildPoseidon } from "circomlibjs";
import { assert } from "chai";
import * as snarkjs from "snarkjs";
import { convertPublicKey, convertSecretKey } from "ed2curve";
import { scalarMult } from "tweetnacl";

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

  // remove leading zeros
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

async function hashBigIntArray(arr: bigint[]) {
  const poseidonEx = await buildPoseidon();
  return poseidonEx(arr, F.zero, 2).map((x) => poseidonEx.F.toObject(x))[1];
}

async function hashMessage(message: string) {
  const binaryMessage = stringToBinary(message);
  const bigIntArrayMessage = binaryStringToBigIntArray(binaryMessage, 253, 10);
  const hash = await hashBigIntArray(bigIntArrayMessage);
  return Array.from(to32ByteBuffer(hash));
}

async function hashKey(key: bigint) {
  const hash = await hashBigIntArray([key]);
  return Array.from(to32ByteBuffer(hash));
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
  const high = Math.floor(Math.random() * 0xffffffff);
  const low = Math.floor(Math.random() * 0xffffffff);
  const nonce = (BigInt(high) << BigInt(32)) | BigInt(low);
  return Array.from(to32ByteBuffer(nonce)).slice(24, 32);
}

async function generateProof(
  message: String,
  key: bigint,
  nonceArray: number[]
) {
  assert(nonceArray.length === 8);
  const MAX_SYMBOLS = 10;
  const nonce = from32ByteBuffer(
    Buffer.from([...Array(24).fill(0), ...nonceArray])
  );
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
    zkeyPath,
    undefined,
    undefined,
    { singleThread: true }
  );

  const curve = await buildBn128(true);

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
  return {
    zkProof: proofFull,
    encryptedMessage: Array.from(encryptedMessage),
  };
}

async function decryptMessage(
  encryptedMessage: number[],
  key: bigint,
  nonceArray: number[]
) {
  const nonce = from32ByteBuffer(
    Buffer.from([...Array(24).fill(0), ...nonceArray])
  );

  const encryptedMessageBuffer = Buffer.from(encryptedMessage);

  // split encryptedMessageBuffer into chunks of 32 bytes
  const chunks = [];
  for (let i = 0; i < encryptedMessageBuffer.length; i += 32) {
    chunks.push(encryptedMessageBuffer.subarray(i, i + 32));
  }

  const bigIntArrayMessage = chunks.map((chunk) => from32ByteBuffer(chunk));

  const decryptedMessage = await poseidonDecrypt(
    bigIntArrayMessage,
    key,
    nonce
  );

  const decryptedBits = bigIntArrayToBinaryString(decryptedMessage, 253);
  const decryptedMessageString = binaryToString(decryptedBits);

  return decryptedMessageString;
}

export {
  hashKey,
  hashMessage,
  sharedSecretFromEd25519Keys,
  generateNonce,
  generateProof,
  decryptMessage,
};
