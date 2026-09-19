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
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  minLength?: number;
  required?: boolean;
  disabled?: boolean;
  icon?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <Form.Group className="mb-3">
      <Form.Label>{label}</Form.Label>
      <InputGroup>
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
    </Form.Group>
  );
}
