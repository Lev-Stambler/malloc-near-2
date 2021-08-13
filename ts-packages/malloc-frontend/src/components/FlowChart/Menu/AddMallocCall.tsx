import { Formik, Field, ErrorMessage, Form } from "formik";
import { MallocCall } from "../../../../../malloc-client/lib/malloc-client";

interface FormikSubmitOpts {
  setSubmitting: (val: boolean) => void;
}
export const AddMallocCall = () => {
  const onSubmit = (
    values: MallocCall,
    { setSubmitting }: FormikSubmitOpts
  ) => {
    (async () => {
      console.log(values);
			window.
      setSubmitting(false);
    })();
  };

  return (
    //@ts-ignore
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
          <label>Malloc Call ID</label>
          <div>
            <Field type="text" name="malloc_call_id" />
            <ErrorMessage name="malloc_call_id" component="div" />
          </div>
          <label>Token ID</label>
          <div>
            <Field type="text" name="token_id" />
            <ErrorMessage name="token_id" component="div" />
          </div>

          <label>Check Callback</label>
          <Field type="checkbox" name="check_callback" />
          <label>Skip FT Transfer</label>
          <Field name="skip_ft_transfer" type="checkbox" />
          <label>JSON Args</label>
          <Field name="json_args" type="textarea" />
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
  );
};
