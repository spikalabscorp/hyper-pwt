import type { ReactElement } from "react";
import { Calendar, dayjsLocalizer } from "react-big-calendar";
import dayjs from "dayjs";

import "react-big-calendar/lib/css/react-big-calendar.css";

const localizer = dayjsLocalizer(dayjs);

export function CalendarWidget(): ReactElement {
    return (
        <Calendar
            localizer={localizer}
            defaultDate={new Date()}
            defaultView="month"
            style={{
                width: 600,
                height: 800
            }}
        />
    );
}
