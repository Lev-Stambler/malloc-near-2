import { MallocClient, SpecialAccountConnectedWallet } from "@malloc/sdk";
import { Field, Form, Formik } from "formik";

interface FormValues {
  amount: string;
  token_id: string;
  initial_node_indices: number[];
  initial_splits: number[];
  next_nodes_indices: number[][][];
  next_nodes_splits: number[][][];
}

export const TextBoxGoView = () => {
  const onSubmit = (values: FormValues, { setSubmitting }: any) => {
    try {
      (async () => {
        console.log(values);
        const client =
          window.mallocClient as MallocClient<SpecialAccountConnectedWallet>;
        console.log(await client.getTokenBalance(window.accountId, values.token_id))
        const tx = await client.deposit(values.amount, values.token_id);
        setSubmitting(false);
      })();
    } catch (e) {
      setSubmitting(false);
      alert("An error occurred, check console logs");
      console.error("Error occured:", e);
    }
  };

  return (
    <>
      <textarea
        name="ephemeral-input"
        placeholder="Malloc Run Ephemeral Input"
        id=""
      ></textarea>
      {/* //@ts-ignore */}
      <Formik onSubmit={onSubmit} initialValues={{}}>
        {({
          values,
          errors,
          touched,
          handleChange,
          handleBlur,
          handleSubmit,
          isSubmitting,
          /* and other goodies */
        }) => (
          <Form className="menu--form">
            <label>Token Id</label>
            <Field type="text" name="token_id" />
            <br />
            <label>Amount</label>
            <Field type="text" name="amount" />
            <br />
            <label>Initial Node Indices</label>
            <Field name="initial_node_indices" />
            <br />
            <label>Initial Splits</label>
            <Field name="initial_splits" type="textarea" />
            <br />
            <label>next_nodes_indices</label>
            <Field name="next_nodes_indices" type="textarea" />
            <br />
            <label>next node splits</label>
            <Field name=" next_nodes_splits" type="textarea" />
            <br />
            <button
              disabled={isSubmitting}
              type="submit"
              className="submit--cta"
              value=""
            >
              Add Malloc Call
            </button>
          </Form>
        )}
      </Formik>
    </>
  );
};
