import { describe, it, expect } from "vitest";
import { renderTemplate } from "../automation.service";

describe("renderTemplate", () => {
  const vars = { first_name: "Ada", course: "Python for Everybody", progress: "42" };

  it("interpolates every placeholder in a real rule template", () => {
    expect(
      renderTemplate(
        "Hi {{first_name}}, your {{course}} is waiting — you're {{progress}}% there!",
        vars,
      ),
    ).toBe("Hi Ada, your Python for Everybody is waiting — you're 42% there!");
  });

  it("repeats a placeholder used more than once", () => {
    expect(renderTemplate("{{course}} / {{course}}", vars)).toBe(
      "Python for Everybody / Python for Everybody",
    );
  });

  it("leaves unknown placeholders visible rather than blanking them", () => {
    expect(renderTemplate("Hi {{nope}}", vars)).toBe("Hi {{nope}}");
  });

  it("passes through templates with no placeholders", () => {
    expect(renderTemplate("Come back!", vars)).toBe("Come back!");
  });
});
