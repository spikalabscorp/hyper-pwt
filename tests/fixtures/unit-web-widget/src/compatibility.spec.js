const { describe, expect, it } = require("@jest/globals");
const styles = require("./styles.css");
require("./theme.less");
require("./theme.scss");
require("./theme.sass");
const imageName = require("./pixel.png");
const SvgIcon = require("./icon.svg");
const { Icon } = require("mendix/components/web/Icon");
const filterBuilders = require("mendix/filters/builders");
const { hot } = require("react-hot-loader/root");

describe("Mendix PWT web Jest compatibility", () => {
  it("loads the jsdom environment, setup file, mappers, transforms, and mocks", () => {
    const element = document.createElement("section");
    document.body.appendChild(element);

    expect(element).toBeInTheDocument();
    expect(new TextEncoder().encode("A")[0]).toBe(65);
    expect(new TextDecoder().decode(Uint8Array.from([65]))).toBe("A");
    expect(styles.fixtureClass).toBe("fixtureClass");
    expect(imageName).toBe("pixel.png");

    const svg = SvgIcon({ role: "img" });
    expect(svg.type).toBe("svg");
    expect(svg.props["data-file-name"]).toBe("SvgIcon");

    const icon = Icon();
    expect(icon.type).toBe("img");
    expect(icon.props.src).toBe("mocked/web/icon");

    filterBuilders.equals("name", "value");
    expect(filterBuilders.equals).toHaveBeenCalledWith("name", "value");

    const Widget = () => null;
    expect(hot(Widget)).toBe(Widget);
    expect(hot).toHaveBeenCalledWith(Widget);
  });
});
