import "regenerator-runtime/runtime";
import React from "react";
import { login, logout, MAX_GAS } from "./utils";
import "./global.css";

import getConfig, { Env } from "./config";
const { networkId } = getConfig((process.env.NODE_ENV as Env) || "development");

export default function App() {
  // after submitting the form, we want to show Notification
  const [showNotification, setShowNotification] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

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

            const { fieldset } = event.target.elements;
            setLoading(true);
            try {
              fieldset.disabled = true;
              // make an update call to the smart contract
              const ret = await window.contract.run_ephemeral(
                {
                  splitter: {
                    owner: "levtester.testnet",
                    split_sum: 200,
                    splits: [100, 100],
                    nodes: [
                      {
                        SimpleTransferLeaf: {
                          recipient: "lev.testnet",
                        },
                      },
                      {
                        SimpleTransferLeaf: {
                          recipient: "lev.testnet",
                        },
                      },
                    ],
                  },
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
              console.log("AAAA");
              // re-enable the form, whether the call succeeded or failed
              setLoading(false);
              fieldset.disabled = false;
            }
            console.log("AAAA");

            // show Notification
            setShowNotification(true);
            console.log("AAAA");

            // remove Notification again after css animation completes
            // this allows it to be shown again next time the form is submitted
            setTimeout(() => {
              console.log("AAAA");
              setShowNotification(false);
            }, 11000);
          }}
        >
          <fieldset id="fieldset">
            <div style={{ display: "flex" }}>
              <button disabled={loading}>Execute the test!</button>
            </div>
          </fieldset>
        </form>
      </main>
      {showNotification && <Notification />}
    </>
  );
}

// this component gets rendered by App after the form is submitted
function Notification() {
  const urlPrefix = `https://explorer.${networkId}.near.org/accounts`;
  return (
    <aside>
      <a
        target="_blank"
        rel="noreferrer"
        href={`${urlPrefix}/${window.accountId}`}
      >
        {window.accountId}
      </a>
      {
        " " /* React trims whitespace around tags; insert literal space character when needed */
      }
      called method: 'run_ephemeral' in contract:{" "}
      <a
        target="_blank"
        rel="noreferrer"
        href={`${urlPrefix}/${window.contract.contractId}`}
      >
        {window.contract.contractId}
      </a>
      <footer>
        <div>✔ Succeeded</div>
        <div>Just now</div>
      </footer>
    </aside>
  );
}
