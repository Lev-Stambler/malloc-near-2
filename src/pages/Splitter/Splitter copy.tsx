import React, { useEffect, useState} from 'react';

import { transactions } from "near-api-js";
import { Notification } from '../../components/Notification';

import getConfig, { env, Env } from "../../config";
import { MAX_GAS, provider } from "../../utils";
const { networkId } = getConfig(env);

export function Splitter() {
	// after submitting the form, we want to show Notification
	const [showNotification, setShowNotification] = React.useState(false);
	const [loading, setLoading] = React.useState(false);
	const [explorerLink, setExplorerLink] = useState("");

	const defaultSplitter = `
	{
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

  	return (
		<>
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
			{showNotification && <Notification explorerLink={explorerLink} />}
		</>
	);
}