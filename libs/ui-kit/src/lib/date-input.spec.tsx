import { describe, it, expect, vi as jest } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DateInput } from "./date-input";
import "@testing-library/jest-dom/vitest";

describe("DateInput", () => {
  it("should render with empty value", () => {
    render(<DateInput value="" onChange={() => undefined} />);
    const input = screen.getByRole("textbox");
    expect(input).toBeInTheDocument();
  });

  it("should format ISO date to DD/MM/YYYY for display", () => {
    render(<DateInput value="2026-12-20" onChange={() => undefined} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("20/12/2026");
  });

  it("should convert DD/MM/YYYY input to ISO format", () => {
    const handleChange = jest.fn();
    render(<DateInput value="" onChange={handleChange} />);
    const input = screen.getByRole("textbox");

    fireEvent.change(input, { target: { value: "20/12/2026" } });

    expect(handleChange).toHaveBeenCalledWith("2026-12-20");
  });

  it("should accept various date formats", () => {
    const handleChange = jest.fn();
    const { rerender } = render(<DateInput value="" onChange={handleChange} />);
    const input = screen.getByRole("textbox");

    // DD/MM/YYYY
    fireEvent.change(input, { target: { value: "20/12/2026" } });
    expect(handleChange).toHaveBeenLastCalledWith("2026-12-20");

    handleChange.mockClear();
    rerender(<DateInput value="" onChange={handleChange} />);

    // DD-MM-YYYY
    fireEvent.change(input, { target: { value: "20-12-2026" } });
    expect(handleChange).toHaveBeenLastCalledWith("2026-12-20");

    handleChange.mockClear();
    rerender(<DateInput value="" onChange={handleChange} />);

    // D/M/YYYY
    fireEvent.change(input, { target: { value: "5/3/2026" } });
    expect(handleChange).toHaveBeenLastCalledWith("2026-03-05");
  });

  it("should handle 2-digit years", () => {
    const handleChange = jest.fn();
    render(<DateInput value="" onChange={handleChange} />);
    const input = screen.getByRole("textbox");

    fireEvent.change(input, { target: { value: "20/12/26" } });
    expect(handleChange).toHaveBeenCalledWith("2026-12-20");
  });

  it("should clear value when empty string is entered", () => {
    const handleChange = jest.fn();
    render(<DateInput value="2026-12-20" onChange={handleChange} />);
    const input = screen.getByRole("textbox");

    fireEvent.change(input, { target: { value: "" } });
    expect(handleChange).toHaveBeenCalledWith("");
  });

  it("should reformat on blur", () => {
    const handleChange = jest.fn();
    render(<DateInput value="" onChange={handleChange} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "5/3/26" } });
    fireEvent.blur(input);

    // Should reformat to DD/MM/YYYY
    expect(input.value).toBe("05/03/2026");
  });

  it("should show placeholder with format", () => {
    render(<DateInput value="" onChange={() => undefined} />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("placeholder", "dd/mm/yyyy");
  });

  it("should accept custom format", () => {
    render(
      <DateInput
        value="2026-12-20"
        onChange={() => undefined}
        format="MM/DD/YYYY"
      />,
    );
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("12/20/2026");
  });

  it("should handle invalid dates gracefully", () => {
    const handleChange = jest.fn();
    render(<DateInput value="" onChange={handleChange} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "32/13/2026" } });
    // Should not call onChange with invalid date
    // The display value will be kept as-is
    expect(input.value).toBe("32/13/2026");

    // On blur, invalid input should be cleared
    fireEvent.blur(input);
    expect(input.value).toBe("");
  });

  it("should support invalid prop for styling", () => {
    const { container } = render(
      <DateInput value="" onChange={() => undefined} invalid />,
    );
    const input = container.querySelector("input");
    expect(input).toHaveAttribute("data-invalid");
  });

  it("should support disabled prop", () => {
    render(<DateInput value="" onChange={() => undefined} disabled />);
    const input = screen.getByRole("textbox");
    expect(input).toBeDisabled();
  });
});
