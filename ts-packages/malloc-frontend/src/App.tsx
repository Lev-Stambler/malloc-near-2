import "regenerator-runtime/runtime";
import React, { useEffect, useState } from "react";
import { login, logout, MAX_GAS, provider } from "./utils";
import "./global.css";

import getConfig, { env, Env } from "./config";
import { transactions } from "near-api-js";
const { networkId } = getConfig(env);


export default function App() {
  // after submitting the form, we want to show Notification
  const [showNotification, setShowNotification] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [explorerLink, setExplorerLink] = useState("");

  // if not signed in, return early with sign-in prompt
  if (!window.walletConnection.isSignedIn()) {
    return (
      <main>
        <h1>Welcome to NEAR!</h1>
        <p>
          To make use of the NEAR blockchain, you need to sign in. The button
          below will sign you in using NEAR Wallet.
        </p>
        <p>
          By default, when your app runs in "development" mode, it connects to a
          test network ("testnet") wallet. This works just like the main network
          ("mainnet") wallet, but the NEAR Tokens on testnet aren't convertible
          to other currencies – they're just for testing!
        </p>
        <p>Go ahead and click the button below to try it out:</p>
        <p style={{ textAlign: "center", marginTop: "2.5em" }}>
          <button onClick={login}>Sign in</button>
        </p>
      </main>
    );
  }

  useEffect(() => {
    const url = new URL(window.location.href);
    const txHash = url.searchParams.get("transactionHashes");
    if (!txHash) return;
    (async () => {
      const result = await provider.txStatus(txHash, window.accountId);
      console.log(result);
      url.searchParams.delete("transactionHashes");
      let newurl =
        window.location.protocol +
        "//" +
        window.location.host +
        window.location.pathname +
        "?" +
        url.searchParams.toString();
      window.history.pushState({ path: newurl }, "", newurl);

      setExplorerLink(`${getConfig(env).explorerUrl}/transactions/${txHash}`);
      setShowNotification(true);
    })();
  }, []);


const defaultSplitter = `{
  "owner": "levtester.testnet",
  "split_sum": 200,
  "splits": [100, 100],
  "nodes": [
    {
      "SimpleTransfer": {
        "recipient": "lev.testnet"
      }
    },
    {
      "SimpleTransfer": {
        "recipient": "lev.testnet"
      }
    }
  ]
}`

  return (
    // use React Fragment, <>, to avoid wrapping elements in unnecessary divs
    <>
      <button className="link" style={{ float: "right" }} onClick={logout}>
        Sign out
      </button>
      <main>
        <h1>Welcome {window.accountId}!</h1>
        <form
          onSubmit={async (event) => {
            event.preventDefault();

            const { fieldset, splitter } = event.target.elements;
            setLoading(true);
            try {
              fieldset.disabled = true;
              // make an update call to the smart contract
              const ret = await window.contract.run_ephemeral(
                {
                  splitter: JSON.parse(splitter.value.toString()),
                },
                MAX_GAS,
                100000
              );
            } catch (e) {
              alert(
                "Something went wrong! " +
                  "Maybe you need to sign out and back in? " +
                  "Check your browser console for more info."
              );
              throw e;
            } finally {
              // re-enable the form, whether the call succeeded or failed
              setLoading(false);
              fieldset.disabled = false;
            }

            // show Notification
            setShowNotification(true);

            // remove Notification again after css animation completes
            // this allows it to be shown again next time the form is submitted
            setTimeout(() => {
              setShowNotification(false);
            }, 11000);
          }}
        >
          <fieldset id="fieldset">
            <textarea name="" defaultValue={defaultSplitter} id="splitter" cols="60" rows="30"></textarea>
            <div style={{ display: "flex" }}>
              <button disabled={loading}>Execute the test!</button>
            </div>
          </fieldset>
        </form>
      </main>
      {showNotification && <Notification explorerLink={explorerLink} />}
    </>
  );
}

interface NotificationProps {
  explorerLink: string;
}

// this component gets rendered by App after the form is submitted
function Notification({ explorerLink }: NotificationProps) {
  return (
    <aside>
      called method: 'run_ephemeral' in contract:
      {` ${window.contract.contractId}`}
      <br />
      <a target="_blank" rel="noreferrer" href={explorerLink}>
        See the explorer link
      </a>
      {/* <footer>
        <div>✔ Succeeded</div>
        <div>Just now</div>
      </footer> */}
    </aside>
  );
}
