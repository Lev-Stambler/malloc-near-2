interface NotificationProps {
  explorerLink: string;
}

// this component gets rendered by App after the form is submitted
export function Notification({ explorerLink }: NotificationProps) {
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
