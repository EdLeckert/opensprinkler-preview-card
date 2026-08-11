# OpenSprinkler Preview Card
A Home Assistant card to display a preview of future irrigation runs using a bar-chart format.

![GitHub Release](https://img.shields.io/github/v/release/EdLeckert/opensprinkler-preview-card)
![Dynamic Regex Badge](https://img.shields.io/badge/dynamic/regex?url=https%3A%2F%2Fraw.githubusercontent.com%2FEdLeckert%2Fopensprinkler-preview-card%2Fmain%2FVERSION&search=.*&label=version&color=blue)
![GitHub License](https://img.shields.io/github/license/EdLeckert/opensprinkler-preview-card)

![OpenSprinkler Preview Card](/img/LightPreview.png)

## What is the OpenSprinkler Preview Card?

The OpenSprinkler Preview Card is a card for the [Home Assistant]([https://home-assistant.io]) Dashboard UI. It displays the
predicted future irrigation run schedule for OpenSprinkler by using the Calendar entity in the
[OpenSprinkler Integration for Home Assistant](https://github.com/vinteo/hass-opensprinkler) integration.
Version 2.0.0 of the integration is required to use this card.

### Features

- Works with the Calendar entity in the [OpenSprinkler Integration for Home Assistant](https://github.com/vinteo/hass-opensprinkler) integration
- Displays the day's calendar entries in a bar-chart format
- Similar to OpenSprinkler's `Program Preview` feature
- Provides a date-picker as well as next and previous day buttons
- Hovering over a run displays more information

## Installation

### Manual

1. Download `opensprinkler-preview-card.js` from `Releases`.
2. Put `opensprinkler-preview-card.js` in your `config/www` folder.
3. Add a reference to `opensprinkler-preview-card.js`:
   Go to _Settings_ → _Dashboards_ → _More Options icon_ → _Resources_ → _Add resource_ → Set _Url_ as `/local/opensprinkler-preview-card.js?v=1.0.0` → Set _Resource type_ as `JavaScript module`.
   Use the version number of the Release you have downloaded for the value of `v=`.

## Usage

To add the card to a Dashboard in Home Assistant:
- :pencil2: Edit Dashboard
- Click `Add card`
- By entity, choose the OpenSprinkler Calendar entity and then the OpenSprinkler Preview Card, or
- By card, choose the OpenSprinkler Preview Card and select the OpenSprinkler Calendar entity.

The YAML for the card is only two lines:

```yaml
type: custom:opensprinkler-preview-card
entity: calendar.opensprinkler_schedule
```

The card defaults to the current day, which is the only day where a Weather Adjustment, if in affect,
will be applied to the run times. Move forward or backward using the arrow buttons, or choose a date from the date picker.

Note that run events in the past are calculated using rules now in effect, and are not a history of exact run behavior.

The Calendar entity on which this card is based is meant to show an approximation of future events,
just like the Program Preview. It considers the following OpenSprinkler settings:

- Schedule types Weekly, Interval, Single run, and Monthly
- Even/Odd Restrictions
- Additional Start Times, Repeating and Fixed
- Date Range
- Rain Delay
- Station Groups
- Station Delay
- Station Ignore Rain Delay
- Weather Adjustment, current day only, multi-day not supported yet

If you hover over a run, additional information from the Calendar will be shown.
