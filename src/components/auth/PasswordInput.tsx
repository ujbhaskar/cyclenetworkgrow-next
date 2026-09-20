"use client";

import { useState } from "react";
import Form from "react-bootstrap/Form";
import InputGroup from "react-bootstrap/InputGroup";
import Button from "react-bootstrap/Button";

export default function PasswordInput({
  value,
  onChange,
  label = "Password",
  minLength,
  required,
  disabled,
  icon,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  minLength?: number;
  required?: boolean;
  disabled?: boolean;
  icon?: string;
  /** Shown below the field, and marks it red — caller owns the validation
   * logic (this component just renders whatever it's given). */
  error?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <Form.Group className="mb-3">
      <Form.Label>{label}</Form.Label>
      <InputGroup hasValidation>
        {icon && (
          <InputGroup.Text>
            <i className={`bi ${icon}`} aria-hidden />
          </InputGroup.Text>
        )}
        <Form.Control
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          minLength={minLength}
          required={required}
          disabled={disabled}
          isInvalid={Boolean(error)}
        />
        <Button
          variant="outline-secondary"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          disabled={disabled}
          tabIndex={-1}
        >
          <i className={`bi ${visible ? "bi-eye-slash" : "bi-eye"}`} aria-hidden />
        </Button>
      </InputGroup>
      {/* .input-group is a flex container, so a full-width message belongs
          outside it (Bootstrap's own documented pattern for InputGroup
          validation) rather than as a flex item squeezed among the input
          segments. */}
      {error && <div className="invalid-feedback d-block">{error}</div>}
    </Form.Group>
  );
}
