import React, { useRef, useState } from 'react';

import ContentEditable from 'react-contenteditable';
import { CoinPicker, Tokens } from './CoinPicker';
import { TokenInfo } from '@baf-wallet/chain-info';

export interface SplitterTopItemProps {
	supportedTokens: Tokens;
	defaultToken: TokenInfo;
	onAmountChange: (amount: number) => void;
	onTokenChange: (token: TokenInfo) => void;
}

export function SplitterTopItem(props: SplitterTopItemProps) {
	const amountRef = useRef('0.0');

	const onAmountChange = (event: any) => {
		const newStr = event.target.value;
		const amount = parseFloat(newStr);

		// don't update the value if it changed
		if (isNaN(amount)) {
			return;
		}

		const rounded = Math.round(amount * 10) / 10;
		amountRef.current = rounded.toFixed(1);
		props.onAmountChange(rounded);
	}

	return (
		<div className="splitter-top-item">
			<ContentEditable
				html={amountRef.current}
				onChange={onAmountChange}
			/>
			<CoinPicker
				onChange={props.onTokenChange}
				defaultToken={props.defaultToken}
				supportedTokens={props.supportedTokens}
			/>
		</div>
	)
}