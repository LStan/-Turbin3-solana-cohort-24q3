import { useState } from "react";
import { Program, BN, web3 } from "@coral-xyz/anchor";
import { WhisperMarket } from "../utils/whisper_market";
import { randomBytes } from "crypto";
import {
  generateNonce,
  hashKey,
  hashMessage,
  sharedSecretFromEd25519Keys,
} from "utils/utils";
import { generateKeyFromSignature } from "@civic/lexi/dist/lib/key";
import { useWallet } from "@solana/wallet-adapter-react";

export default function PurchaseListing({
  program,
  marketplace,
}: {
  program?: Program<WhisperMarket>;
  marketplace: web3.PublicKey;
}) {
  const wallet = useWallet();
  const [tx, setTx] = useState("");
  const [listingAddress, setListingAddress] = useState<string>();

  const purchaseListing = async () => {
    if (!program) {
      return;
    }

    try {
      const listingAccount = await program.account.listing.fetch(
        listingAddress
      ); //new web3.PublicKey(listingAddress);
      console.log(listingAccount);

      const key = await generateKeyFromSignature(wallet, listingAddress);
      const buyerKeypair = web3.Keypair.fromSeed(key);

      const encryptKey = sharedSecretFromEd25519Keys(
        buyerKeypair.secretKey,
        listingAccount.sellerPkEncrypt.toBytes()
      );

      const encryptKeyHash = await hashKey(encryptKey);
      const nonce = generateNonce();

      const tx = await program.methods
        .purchase(encryptKeyHash, nonce, buyerKeypair.publicKey)
        .accountsPartial({
          buyer: wallet.publicKey,
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

      <button className="btn btn-neutral" onClick={purchaseListing}>
        Purchase listing
      </button>
      {tx && (
        <div className="text-sm font-normal align-bottom text-slate-600">
          https://explorer.solana.com/tx/${tx}?cluster=devnet
        </div>
      )}
    </>
  );
}
