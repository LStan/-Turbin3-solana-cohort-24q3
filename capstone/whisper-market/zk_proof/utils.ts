import { ZqField } from "ffjavascript";
import { buildPoseidon } from "circomlibjs";
import { assert } from "chai";

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

async function poseidonEncrypt(message: BigInt[], key: BigInt, nonce: BigInt) {
  const poseidonEx = await buildPoseidon();

  let state = [F.zero, F.e(key), F.e(nonce)];
  const ciphertext: BigInt[] = [];

  for (let i = 0; i < message.length; i++) {
    state = poseidonEx(state.slice(1), state[0], 2).map((x) =>
      poseidonEx.F.toObject(x)
    );

    state[1] = F.add(state[1], message[i]);
    ciphertext.push(state[1]);
  }

  return ciphertext;
}

async function poseidonDecrypt(
  ciphertext: BigInt[],
  key: BigInt,
  nonce: BigInt
) {
  const poseidonEx = await buildPoseidon();
  let state = [F.zero, F.e(key), F.e(nonce)];
  const message: BigInt[] = [];

  for (let i = 0; i < ciphertext.length; i++) {
    state = poseidonEx(state.slice(1), state[0], 2).map((x) =>
      poseidonEx.F.toObject(x)
    );
    message.push(F.sub(ciphertext[i], state[1]));
    state[1] = ciphertext[i];
  }
  return message;
}

async function hashMessage(message: BigInt[]) {
  const poseidonEx = await buildPoseidon();
  return poseidonEx(message, F.zero, 2).map((x) => poseidonEx.F.toObject(x))[1];
}

async function hashKey(key: BigInt) {
  const poseidonEx = await buildPoseidon();
  return poseidonEx([key], F.zero, 2).map((x) => poseidonEx.F.toObject(x))[1];
}

async function fullPathTest() {
  const MAX_SYMBOLS = 10;

  const message = "Hello, World!";
  const key = BigInt(5);
  const nonce = BigInt(77);

  const binary = stringToBinary(message);
  //   console.log(binary);

  const bigIntArray = binaryStringToBigIntArray(binary, 253, MAX_SYMBOLS);
  const encryptedMessage = await poseidonEncrypt(bigIntArray, key, nonce);
  //   const encryptedMessage = bigIntArray;
  //   console.log(encryptedMessage.length);

  const encryptedBits = bigIntArrayToBinaryString(encryptedMessage, 254);
  //   console.log(encryptedBits);

  const encryptedBytes = binaryStringToBigIntArray(encryptedBits, 8, 318);

  const encryptedBitsReturned = bigIntArrayToBinaryString(encryptedBytes, 8);
  //   console.log(encryptedBits === encryptedBitsReturned);
  //   console.log(encryptedBits.length);

  const encryptedMessageReturned = binaryStringToBigIntArray(
    encryptedBitsReturned,
    254,
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
}

fullPathTest();
