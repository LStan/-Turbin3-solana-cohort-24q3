import { useState } from "react";
import { Program, BN, web3 } from "@coral-xyz/anchor";
import { WhisperMarket } from "../utils/whisper_market";
import { randomBytes } from "crypto";
import {
  decryptMessage,
  generateNonce,
  hashKey,
  hashMessage,
  sharedSecretFromEd25519Keys,
} from "utils/utils";
import { generateKeyFromSignature } from "@civic/lexi/dist/lib/key";
import { useWallet } from "@solana/wallet-adapter-react";

export default function DecryptMessage({
  program,
}: {
  program?: Program<WhisperMarket>;
}) {
  const wallet = useWallet();
  const [listingAddress, setListingAddress] = useState<string>();
  const [message, setMessage] = useState<string>();

  const decrypt = async () => {
    if (!program) {
      return;
    }

    try {
      const listingAccount = await program.account.listing.fetch(
        listingAddress
      );

      const key = await generateKeyFromSignature(wallet, listingAddress);
      const buyerKeypair = web3.Keypair.fromSeed(key);

      const decryptKey = sharedSecretFromEd25519Keys(
        buyerKeypair.secretKey,
        listingAccount.sellerPkEncrypt.toBytes()
      );

      const decryptedMessage = await decryptMessage(
        listingAccount.encryptedMessage,
        decryptKey,
        listingAccount.encryptNonce
      );

      setMessage(decryptedMessage);
    } catch (error) {
      console.log("error", error);
    }
  };

  return (
    <>
      <input
        type="text"
        placeholder="Listing Address"
        className="input input-bordered min-w-96"
        value={listingAddress}
        onChange={(e) => setListingAddress(e.target.value)}
      />
      <button className="btn btn-neutral" onClick={decrypt}>
        Decrypt Message
      </button>
      <textarea
        className="textarea textarea-bordered min-w-96"
        placeholder="Message"
        value={message}
      ></textarea>
    </>
  );
}
