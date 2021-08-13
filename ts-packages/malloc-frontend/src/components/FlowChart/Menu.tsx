import "./flowchart.css";
import { AddMallocCall } from "./Menu/AddMallocCall";

const FlowMenu = () => (
  <div className="menu">
    {/* <button onClick={resetTransform} style={{ marginRight: 5 }}>
            reset transform
          </button>
          <button onClick={updatePos} style={{ marginRight: 5 }}>
            change pos
          </button>
          <button onClick={logToObject}>toObject</button> */}
    <div className="menu--item">
      <AddMallocCall></AddMallocCall>
    </div>
    <div className="menu--item">
      <form action="">
        <label htmlFor="input">Malloc Call ID</label>
        <input type="text" />
        <label htmlFor="input">Token ID</label>
        <input type="text" />
        <input
          type="submit"
          className="submit--cta"
          value="Add FT Transfer Call to Malloc Call"
        />
      </form>
    </div>
    <div className="menu--item">
      <button>Deposit into Malloc</button>
    </div>
    <div className="menu--item">
      <button>Register Construction</button>
    </div>
    <div className="menu--item">
      <button>Make the call</button>
    </div>
  </div>
);

export default FlowMenu;
