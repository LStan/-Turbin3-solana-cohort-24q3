import { useState } from "react";
import { Program, BN, web3 } from "@coral-xyz/anchor";
import { WhisperMarket } from "../utils/whisper_market";
import { randomBytes } from "crypto";
import {
  generateProof,
  hashMessage,
  sharedSecretFromEd25519Keys,
} from "utils/utils";
import { generateKeyFromSignature } from "@civic/lexi/dist/lib/key";
import { useWallet } from "@solana/wallet-adapter-react";

export default function CompletePurchase({
  program,
  marketplace,
}: {
  program?: Program<WhisperMarket>;
  marketplace: web3.PublicKey;
}) {
  const wallet = useWallet();
  const [listingAddress, setListingAddress] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [tx, setTx] = useState<string>();
  const [error, setError] = useState<string>();

  const completePurchase = async () => {
    setError("");
    if (!program) {
      return;
    }

    try {
      const listingAccount = await program.account.listing.fetch(
        listingAddress
      );

      const messageHash = await hashMessage(message);

      if (
        JSON.stringify(messageHash) !==
        JSON.stringify(listingAccount.messageHash)
      ) {
        setError("Message hash does not match");
        return;
      }

      const key = await generateKeyFromSignature(wallet, listingAddress);
      const sellerKeypair = web3.Keypair.fromSeed(key);

      const encryptKey = sharedSecretFromEd25519Keys(
        sellerKeypair.secretKey,
        listingAccount.buyerPkEncrypt.toBytes()
      );

      const { encryptedMessage, zkProof } = await generateProof(
        message,
        encryptKey,
        listingAccount.encryptNonce
      );

      const tx = await program.methods
        .completePurchase(encryptedMessage, zkProof)
        .accountsPartial({
          seller: wallet.publicKey,
          marketplace,
          listing: new web3.PublicKey(listingAddress),
        })
        .rpc();

      setTx(tx);
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
      <textarea
        className="textarea textarea-bordered min-w-96"
        placeholder="Message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      ></textarea>
      <button className="btn btn-neutral" onClick={completePurchase}>
        Complete Purchase
      </button>
      {error && (
        <div className="text-sm font-normal align-bottom text-red-600">
          {error}
        </div>
      )}
      {tx && (
        <div className="text-sm font-normal align-bottom text-slate-600">
          https://explorer.solana.com/tx/${tx}?cluster=devnet
        </div>
      )}
    </>
  );
}
