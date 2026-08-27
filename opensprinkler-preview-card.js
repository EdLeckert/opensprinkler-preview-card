const LitElement = Object.getPrototypeOf(customElements.get("ha-panel-lovelace"));
const { html, css } = LitElement.prototype;
var VERSION = "1.0.0"
class OpenSprinklerPreviewCard extends LitElement {
    static get properties() {
        return {
            hass: {},
            config: {},
            currentDate: { type: Object },
            events: { type: Array },
            stations: { type: Array },
            timelineStart: { type: Number },
            timelineEnd: { type: Number },
            nowPercent: { type: Number },
            totalHours: { type: Number },
            gridOffsetRatio: { type: Number },
            dynamicColorMap: { type: Object }
        };
    }

    constructor() {
        super();
        this.currentDate = new Date();
        this.events = [];
        this.stations = [];
        this.dynamicColorMap = {};
        this.timelineStart = 0;
        this.timelineEnd = 0;
        this.nowPercent = -1;
        this.totalHours = 12;
        this.gridOffsetRatio = 0;
        this._timeUpdateInterval = null;
    }

    connectedCallback() {
        super.connectedCallback();
        this._timeUpdateInterval = setInterval(() => this.updateNowMarker(), 30000);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._timeUpdateInterval) clearInterval(this._timeUpdateInterval);
    }

    setConfig(config) {
        if (!config.entity) {
            throw new Error("You must define a calendar entity.");
        }
        this.config = config;
    }

    updated(changedProperties) {
        if (changedProperties.has("hass") || changedProperties.has("currentDate")) {
            this.fetchCalendarData();
        }
    }

    async fetchCalendarData() {
        if (!this.hass || !this.config.entity) return;

        const startOfDay = new Date(this.currentDate);
        startOfDay.setHours(0, 0, 0, 0);

        // Add a day to new Date object.
        const endOfDay = new Date(new Date(startOfDay).setDate(startOfDay.getDate() + 1));

        try {
            const events = await this.hass.callApi(
                "GET",
                `calendars/${this.config.entity}?start=${startOfDay.toISOString()}&end=${endOfDay.toISOString()}`
            );

            this.events = events || [];
            this.processTimelineBounds();
            this.updateNowMarker();
        } catch (err) {
            console.error("Error fetching Home Assistant calendar data:", err);
        }
    }

    generateHueFromString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        return Math.abs(hash % 360);
    }

    processTimelineBounds() {
        if (this.events.length === 0) {
            const base = new Date(this.currentDate);
            this.timelineStart = new Date(base.setHours(6, 0, 0, 0)).getTime();
            this.timelineEnd = new Date(base.setHours(18, 0, 0, 0)).getTime();
            this.totalHours = 12;
            this.gridOffsetRatio = 0;
            this.stations = [];
            this.dynamicColorMap = {};
            return;
        }

        const uniqueStations = [...new Set(this.events.map((e) => e.summary))];
        const stationWithEarliestTime = uniqueStations.map(stationName => {
            const stationEvents = this.events.filter(e => e.summary === stationName);
            const earliestStart = Math.min(
                ...stationEvents.map(e => new Date(e.start.dateTime || e.start.date).getTime())
            );
            return { name: stationName, time: earliestStart };
        });
        stationWithEarliestTime.sort((a, b) => a.time - b.time);
        this.stations = stationWithEarliestTime.map(item => item.name);

        const newColorMap = {};
        this.events.forEach(event => {
            const desc = (event.description && event.description.trim()) || "Unassigned";
            if (!newColorMap[desc]) {
                const hue = this.generateHueFromString(desc);
                newColorMap[desc] = `linear-gradient(90deg, hsl(${hue}, 75%, 45%), hsl(${(hue + 25) % 360}, 85%, 55%))`;
            }
        });
        this.dynamicColorMap = newColorMap;

        const timestamps = this.events.flatMap((e) => [
            new Date(e.start.dateTime || e.start.date).getTime(),
            new Date(e.end.dateTime || e.end.date).getTime(),
        ]);

        const padding = 15 * 60 * 1000;
        this.timelineStart = Math.min(...timestamps);
        this.timelineEnd = Math.max(...timestamps) + padding;

        const totalDurationMs = this.timelineEnd - this.timelineStart;
        this.totalHours = totalDurationMs / (1000 * 60 * 60);

        const startDateTime = new Date(this.timelineStart);
        const msPastHour = (startDateTime.getMinutes() * 60 * 1000) +
            (startDateTime.getSeconds() * 1000) +
            startDateTime.getMilliseconds();

        if (msPastHour === 0) {
            this.gridOffsetRatio = 0;
        } else {
            const msToNextHour = (60 * 60 * 1000) - msPastHour;
            this.gridOffsetRatio = msToNextHour / totalDurationMs;
        }
    }

    updateNowMarker() {
        const now = new Date();
        const isToday = now.toDateString() === this.currentDate.toDateString();

        if (!isToday || this.events.length === 0) {
            this.nowPercent = -1;
            return;
        }

        const nowMs = now.getTime();
        if (nowMs >= this.timelineStart && nowMs <= this.timelineEnd) {
            const totalDuration = this.timelineEnd - this.timelineStart;
            this.nowPercent = ((nowMs - this.timelineStart) / totalDuration) * 100;
        } else {
            this.nowPercent = -1;
        }
        this.requestUpdate(); // Forces UI re-render for glow class updates
    }

    navigateDay(offset) {
        const newDate = new Date(this.currentDate);
        newDate.setDate(newDate.getDate() + offset);
        this.currentDate = newDate;
    }

    handleDatePicker(e) {
        const selectedValue = e.target.value;
        if (selectedValue) {
            const parts = selectedValue.split('-');
            const newDate = new Date();
            newDate.setFullYear(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
            this.currentDate = newDate;
        }
    }

    openCalendarPicker() {
        const picker = this.shadowRoot.querySelector('.hidden-date-picker');
        if (picker) {
            if (typeof picker.showPicker === 'function') {
                picker.showPicker();
            } else {
                picker.click();
            }
        }
    }

    calculateBarStyles(eventStartStr, eventEndStr) {
        const start = new Date(eventStartStr).getTime();
        const end = new Date(eventEndStr).getTime();
        const totalDuration = this.timelineEnd - this.timelineStart;

        const left = ((start - this.timelineStart) / totalDuration) * 100;
        const width = ((end - start) / totalDuration) * 100;

        return `left: ${Math.max(0, left)}%; width: ${Math.min(100, width)}%;`;
    }

    formatTimeLabel(timestamp) {
        return new Date(timestamp).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
        });
    }

    // Evaluates if a station profile has an active run window at this precise moment
    isStationCurrentlyActive(stationEvents) {
        const nowMs = new Date().getTime();
        const isToday = new Date().toDateString() === this.currentDate.toDateString();
        if (!isToday) return false;

        return stationEvents.some(event => {
            const start = new Date(event.start.dateTime || event.start.date).getTime();
            const end = new Date(event.end.dateTime || event.end.date).getTime();
            return nowMs >= start && nowMs <= end;
        });
    }

    render() {
        if (!this.hass) return html``;

        const dateHeader = this.currentDate.toLocaleDateString([], {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
        });

        const isoString = this.currentDate.getFullYear() + '-' +
            String(this.currentDate.getMonth() + 1).padStart(2, '0') + '-' +
            String(this.currentDate.getDate()).padStart(2, '0');

        const legendKeys = Object.keys(this.dynamicColorMap);

        // Calculate structural dimensions for the timeline lane container width
        const laneBackgroundSize = `calc(100% / ${this.totalHours}) 100%`;

        // MATHEMATICAL GRID ALIGNMENT ENGINE FIX
        // Calculate the percentage width of exactly 1 hour on our current scale
        const percentPerHour = 100 / this.totalHours;

        // Determine how many hours/fractional hours we need to slide left to hit the first top-of-the-hour
        const startDateTime = new Date(this.timelineStart);
        const msPastHour = (startDateTime.getMinutes() * 60 * 1000) +
            (startDateTime.getSeconds() * 1000) +
            startDateTime.getMilliseconds();

        const msToNextHour = msPastHour === 0 ? 0 : (60 * 60 * 1000) - msPastHour;
        const hoursToNextHour = msToNextHour / (1000 * 60 * 60);

        // Find the exact percentage index where the first grid line belongs
        const firstLinePercent = hoursToNextHour * percentPerHour;

        // TRICK: Move background-position using standard percentages, but scale it linearly 
        // by dividing by (1 - (tile_width_ratio)) to cancel out CSS container-alignment behavior!
        const tileWidthRatio = 1 / this.totalHours;
        const linearPositionPercent = tileWidthRatio === 1 ? 0 : firstLinePercent / (1 - tileWidthRatio);
        const laneBackgroundPosition = `${linearPositionPercent}% 0`;

        // Generate matching timeline text labels row matrix data arrays
        const hourlyLabels = [];
        if (this.events.length > 0) {
            const firstTickMs = this.timelineStart + msToNextHour;
            for (let i = 0; i < this.totalHours; i++) {
                const currentTickMs = firstTickMs + (i * 1000 * 60 * 60);
                if (currentTickMs <= this.timelineEnd) {
                    const totalDuration = this.timelineEnd - this.timelineStart;
                    const leftPercent = ((currentTickMs - this.timelineStart) / totalDuration) * 100;
                    const labelText = new Date(currentTickMs).toLocaleTimeString([], { hour: "numeric" });
                    hourlyLabels.push({ left: leftPercent, text: labelText });
                }
            }
        }

        return html`
      <ha-card>
        <header class="card-header-actions">
          <button class="nav-btn" @click="${() => this.navigateDay(-1)}">&lt;</button>
          
          <div class="date-container" @click="${this.openCalendarPicker}">
            <h2 class="date-display">${dateHeader}</h2>
            <span class="calendar-icon">📅</span>
            <input 
              type="date" 
              class="hidden-date-picker" 
              .value="${isoString}" 
              @input="${this.handleDatePicker}"
            />
          </div>

          <button class="nav-btn" @click="${() => this.navigateDay(1)}">&gt;</button>
        </header>

        ${legendKeys.length > 0 ? html`
          <div class="legend-container">
            ${legendKeys.map(descText => html`
              <div class="legend-item">
                <span class="legend-patch" style="background: ${this.dynamicColorMap[descText]};"></span>
                <span class="legend-text">${descText}</span>
              </div>
            `)}
          </div>
        ` : html``}

        <section class="gantt-container">
          ${this.events.length === 0
                ? html`<p class="no-programs">No irrigation programs scheduled.</p>`
                : html`
                <header class="time-axis">
                  <div class="axis-label-wrapper">
                    <span>${this.formatTimeLabel(this.timelineStart)}</span>
                    <span>${this.formatTimeLabel(this.timelineEnd)}</span>
                  </div>
                </header>

                <div class="chart-relative-box">
                  <ul class="chart-body">
                    ${this.stations.map((station) => {
                    const stationEvents = this.events.filter((e) => e.summary === station);
                    const isActive = this.isStationCurrentlyActive(stationEvents);

                    return html`
                        <li class="station-row">
                          ${station}</span>
                          <main class="timeline-lane ${isActive ? 'watering-active' : ''}" style="background-size: ${laneBackgroundSize}; background-position: ${laneBackgroundPosition};">
                            ${this.nowPercent >= 0
                            ? html`<div class="live-now-line" style="left: ${this.nowPercent}%;"></div>`
                            : html``
                        }

                            ${stationEvents.map((event) => {
                            const startTimeStr = event.start.dateTime || event.start.date;
                            const endTimeStr = event.end.dateTime || event.end.date;
                            const barStyle = this.calculateBarStyles(startTimeStr, endTimeStr);
                            const durationMin = Math.round(
                                (new Date(endTimeStr).getTime() - new Date(startTimeStr).getTime()) / 60000
                            );

                            const timeTooltip = `${this.formatTimeLabel(new Date(startTimeStr).getTime())} - ${this.formatTimeLabel(new Date(endTimeStr).getTime())}`;
                            const eventDesc = (event.description && event.description.trim()) || "Unassigned";
                            const barBackground = this.dynamicColorMap[eventDesc];

                            return html`
                                <section
                                  class="program-bar"
                                  style="${barStyle} background: ${barBackground} !important;"
                                  title="${event.description}: ${durationMin} mins (${timeTooltip})"
                                >
                                  <span class="bar-bubble-text">${durationMin}m</span>
                                </section>
                              `;
                        })}
                          </main>
                        </li>
                      `;
                })}
                  </ul>

                  <div class="hourly-labels-row">
                    ${hourlyLabels.map(label => html`
                      <div class="hourly-tick-wrapper" style="left: ${label.left}%;">
                        <span class="hourly-tick-label">${label.text}</span>
                      </div>
                    `)}
                  </div>
                </div>
              `}
        </section>
      </ha-card>
    `;
    }

    static get styles() {
        return css`
      :host {
        display: block !important;
        width: 100% !important;
      }
      ha-card {
        padding: 16px;
        background-color: var(--ha-card-background, var(--card-background-color, white));
      }
      .card-header-actions {
        display: flex !important;
        flex-direction: row !important;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }
      .nav-btn {
        background: transparent;
        border: 1px solid var(--divider-color, #e0e0e0);
        color: var(--primary-text-color, #212121);
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
      }
      .date-container {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
        transition: background-color 0.2s;
        position: relative;
      }
      .date-container:hover {
        background-color: var(--secondary-background-color, #f5f5f5);
      }
      .date-display {
        font-size: 1.1em;
        font-weight: 500;
        margin: 0;
        color: var(--primary-text-color, #212121);
      }
      .calendar-icon {
        font-size: 1.1em;
      }
      .hidden-date-picker {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        opacity: 0;
        cursor: pointer;
        pointer-events: none;
      }
      .legend-container {
        display: flex !important;
        flex-direction: row !important;
        flex-wrap: wrap;
        justify-content: center;
        gap: 16px;
        margin-bottom: 16px;
        padding: 4px 0;
      }
      .legend-item {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .legend-patch {
        width: 14px;
        height: 14px;
        border-radius: 3px;
        display: inline-block;
        box-shadow: 0 1px 2px rgba(0,0,0,0.15);
      }
      .legend-text {
        font-size: 0.8em;
        color: var(--secondary-text-color);
        font-weight: 500;
      }
      .gantt-container {
        display: block !important;
        width: 100%;
      }
      .no-programs {
        text-align: center;
        padding: 24px;
        color: var(--secondary-text-color, #727272);
        font-style: italic;
        margin: 0;
      }
      .time-axis {
        display: block !important;
        margin-left: 130px !important; 
        border-bottom: 1px dashed var(--divider-color, #e0e0e0);
        padding-bottom: 4px;
        margin-bottom: 8px;
      }
      .axis-label-wrapper {
        display: flex !important;
        flex-direction: row !important;
        justify-content: space-between;
        font-size: 0.85em;
        color: var(--secondary-text-color);
        }
        .chart-relative-box {
        position: relative !important;
        width: 100%;
        }
        .live-now-line {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 2px;
        background-color: var(--error-color, #f44336);
        z-index: 10;
        pointer-events: none;
        overflow: visible;
        height: 140%
        }
        .chart-body {
        display: flex !important;
        flex-direction: column !important;
        gap: 12px;
        padding: 0;
        margin: 0;
        list-style: none;
        }
        .station-row {
        display: grid !important;
        grid-template-columns: 120px 1fr !important;
        gap: 10px !important;
        align-items: center !important;
        height: 32px !important;
        width: 100% !important;
        padding: 0;
        margin: 0;
        }
        .timeline-lane {
        position: relative !important;
        display: block !important;
        height: 32px !important;
        background-color: var(--secondary-background-color, #fafafa);
        background-image:
        linear-gradient(to right, rgba(0, 0, 0, 0.15) 1.5px, transparent 1.5px),
        linear-gradient(to right, rgba(255, 255, 255, 0.6) 1.5px, transparent 1.5px) !important;
        background-repeat: repeat-x !important;
        border-radius: 6px;
        box-shadow: inset 0 1px 3px rgba(0,0,0,0.12);
        padding: 0;
        margin: 0;
        transition: box-shadow 0.3s ease-in-out;
        }
        .watering-active {
        box-shadow: 0 0 10px var(--error-color, #f44336), inset 0 1px 3px rgba(0,0,0,0.12) !important;
        animation: pulseGlow 2s infinite alternate ease-in-out;
        }
        @keyframes pulseGlow {
        0% { box-shadow: 0 0 4px rgba(244, 67, 54, 0.4), inset 0 1px 3px rgba(0,0,0,0.12); }
        100% { box-shadow: 0 0 14px rgba(244, 67, 54, 0.9), inset 0 1px 3px rgba(0,0,0,0.12); }
        }
        .hourly-labels-row {
        position: relative !important;
        margin-left: 130px !important;
        height: 20px;
        margin-top: 6px;
        }
        .hourly-tick-wrapper {
        position: absolute;
        transform: translateX(-50%);
        white-space: nowrap;
        }
        .hourly-tick-label {
        font-size: 0.75em;
        color: var(--secondary-text-color);
        font-weight: 500;
        }
        .program-bar {
        position: absolute !important;
        top: 4px !important;
        bottom: 4px !important;
        border-radius: 4px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        min-width: 18px !important;
        box-shadow: 0 1px 3px rgba(0,0,0,0.15);
        z-index: 2 !important;
        cursor: help;
        }
        .bar-bubble-text {
        font-size: 0.75em;
        color: white !important;
        font-weight: bold;
        white-space: nowrap;
        padding: 0 2px;
        }
        `;
    }

    static getConfigForm() {
        return {
            schema: [
                {
                    name: "entity",
                    selector: {
                        entity: {
                            domain: "calendar"
                        }
                    },
                },
            ],
        };
    }
}

customElements.define("opensprinkler-preview-card", OpenSprinklerPreviewCard);

window.customCards = window.customCards || [];
window.customCards.push({
    type: "opensprinkler-preview-card",
    name: "OpenSprinkler Preview Card",
    description: "A card to display a preview of future irrigation runs using a bar-chart format.",
    // Opt-in to the modern card picker suggestions for specific domains
    getEntitySuggestion: (hass, entityId) => {
        const domain = entityId.split(".")[0];
        if (domain !== "calendar") {
            return null; // Return null if the entity type isn't compatible
        }
        return {
            config: {
                type: "custom:opensprinkler-preview-card",
                entity: entityId,
            },
        };
    },
});

console.info(
    `%c OPENSPRINKLER PREVIEW CARD %c ${VERSION} `,
    "background: #2196f3; color: #fff; font-weight: bold; padding: 2px 4px; border-radius: 3px 0 0 3px;",
    "background: var(--secondary-background-color, #fafafa); color: var(--primary-text-color, #212121); padding: 2px 4px; border-radius: 0 3px 3px 0; border: 1px solid #2196f3;"
);
