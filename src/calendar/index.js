import React, {Component} from 'react';
import * as ReactNative from 'react-native';
import PropTypes from 'prop-types';
import XDate from 'xdate';

import dateutils from '../dateutils';
import {xdateToData, parseDate} from '../interface';
import styleConstructor from './style';
import Day from './day/basic';
import UnitDay from './day/period';
import MultiDotDay from './day/multi-dot';
import MultiPeriodDay from './day/multi-period';
import SingleDay from './day/custom';
import CalendarHeader from './header';
import shouldComponentUpdate from './updater';
import GestureRecognizer, {swipeDirections} from 'react-native-swipe-gestures';
import {SELECT_DATE_SLOT} from '../testIDs';

//Fallback for react-native-web or when RN version is < 0.44
const {View} = ReactNative;

const EmptyArray = [];

/**
 * @description: Calendar component
 * @example: https://github.com/wix/react-native-calendars/blob/master/example/src/screens/calendars.js
 * @gif: https://github.com/wix/react-native-calendars/blob/master/demo/calendar.gif
 */
class Calendar extends Component {
  static displayName = 'Calendar';

  

  static defaultProps = {
    enableSwipeMonths: false
  };

  constructor(props) {
    super(props);

    this.style = styleConstructor(this.props.theme);
    this.state = {
      currentMonth: props.current ? parseDate(props.current) : XDate()
    };

    this.updateMonth = this.updateMonth.bind(this);
    this.pressDay = this.pressDay.bind(this);
    this.longPressDay = this.longPressDay.bind(this);
    this.shouldComponentUpdate = shouldComponentUpdate;
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    const current= parseDate(nextProps.current);
    if (current && current.toString('yyyy MM') !== this.state.currentMonth.toString('yyyy MM')) {
      this.setState({
        currentMonth: current.clone()
      });
    }
  }

  updateMonth(day, doNotTriggerListeners) {
    if (day.toString('yyyy MM') === this.state.currentMonth.toString('yyyy MM')) {
      return;
    }
    this.setState({
      currentMonth: day.clone()
    }, () => {
      if (!doNotTriggerListeners) {
        const currMont = this.state.currentMonth.clone();
        if (this.props.onMonthChange) {
          this.props.onMonthChange(xdateToData(currMont));
        }
        if (this.props.onVisibleMonthsChange) {
          this.props.onVisibleMonthsChange([xdateToData(currMont)]);
        }
      }
    });
  }

  _handleDayInteraction(date, interaction) {
    const day = parseDate(date);
    const minDate = parseDate(this.props.minDate);
    const maxDate = parseDate(this.props.maxDate);
    if (!(minDate && !dateutils.isGTE(day, minDate)) && !(maxDate && !dateutils.isLTE(day, maxDate))) {
      const shouldUpdateMonth = this.props.disableMonthChange === undefined || !this.props.disableMonthChange;
      if (shouldUpdateMonth) {
        this.updateMonth(day);
      }
      if (interaction) {
        interaction(xdateToData(day));
      }
    }
  }

  pressDay(date) {
    this._handleDayInteraction(date, this.props.onDayPress);
  }

  longPressDay(date) {
    this._handleDayInteraction(date, this.props.onDayLongPress);
  }

  addMonth = (count) => {
    this.updateMonth(this.state.currentMonth.clone().addMonths(count, true));
  }

  isDateNotInTheRange = (minDate, maxDate, date) => {
    return (minDate && !dateutils.isGTE(date, minDate)) || (maxDate && !dateutils.isLTE(date, maxDate));
  }

  getAccessibilityLabel = (state, day) => {
    const today = XDate.locales[XDate.defaultLocale].today;
    const formatAccessibilityLabel = XDate.locales[XDate.defaultLocale].formatAccessibilityLabel;
    const isToday = state === 'today';
    const markingLabel = this.getDateMarking(day);

    if (formatAccessibilityLabel) {
      return `${isToday ? today : ''} ${day.toString(formatAccessibilityLabel)} ${markingLabel}`;
    }

    return `${isToday ? 'today' : ''} ${day.toString('dddd d MMMM yyyy')} ${markingLabel}`;
  }


  renderDay(day, id) {
    const minDate = parseDate(this.props.minDate);
    const maxDate = parseDate(this.props.maxDate);
    let state = '';
    if (this.props.disabledByDefault) {
      state = 'disabled';
    } else if (this.isDateNotInTheRange(minDate, maxDate, day)) {
      state = 'disabled';
    } else if (!dateutils.sameMonth(day, this.state.currentMonth)) {
      state = 'disabled';
    } else if (dateutils.sameDate(day, XDate())) {
      state = 'today';
    }

    if (!dateutils.sameMonth(day, this.state.currentMonth) && this.props.hideExtraDays) {
      return (<View key={id} style={{flex: 1}}/>);
    }

    const DayComp = this.getDayComponent();
    const date = day.getDate();
    const dateAsObject = xdateToData(day);
    const accessibilityLabel = this.getAccessibilityLabel(state, day);

    return (
      <View style={{flex: 1, alignItems: 'center'}} key={id}>
        <DayComp
          testID={`${SELECT_DATE_SLOT}-${dateAsObject.dateString}`}
          state={state}
          theme={this.props.theme}
          onPress={this.pressDay}
          onLongPress={this.longPressDay}
          date={dateAsObject}
          marking={this.getDateMarking(day)}
          accessibilityLabel={accessibilityLabel}
          disableAllTouchEventsForDisabledDays={this.props.disableAllTouchEventsForDisabledDays}
        >
          {date}
        </DayComp>
      </View>
    );
  }

  getMarkingLabel(day) {
    let label = '';
    const marking = this.getDateMarking(day);

    if (marking.accessibilityLabel) {
      return marking.accessibilityLabel;
    }

    if (marking.selected) {
      label += 'selected ';
      if (!marking.marked) {
        label += 'You have no entries for this day ';
      }
    }
    if (marking.marked) {
      label += 'You have entries for this day ';
    }
    if (marking.startingDay) {
      label += 'period start ';
    }
    if (marking.endingDay) {
      label += 'period end ';
    }
    if (marking.disabled || marking.disableTouchEvent) {
      label += 'disabled ';
    }
    return label;
  }

  getDayComponent() {
    if (this.props.dayComponent) {
      return this.props.dayComponent;
    }

    switch (this.props.markingType) {
    case 'period':
      return UnitDay;
    case 'multi-dot':
      return MultiDotDay;
    case 'multi-period':
      return MultiPeriodDay;
    case 'custom':
      return SingleDay;
    default:
      return Day;
    }
  }

  getDateMarking(day) {
    if (!this.props.markedDates) {
      return false;
    }

    const dates = this.props.markedDates[day.toString('yyyy-MM-dd')] || EmptyArray;
    if (dates.length || dates) {
      return dates;
    } else {
      return false;
    }
  }

  onSwipe = (gestureName) => {
    const {enableSwipeMonths} = this.props;
    if (!enableSwipeMonths) {
      return;
    }

    const {SWIPE_UP, SWIPE_DOWN, SWIPE_LEFT, SWIPE_RIGHT} = swipeDirections;
    switch (gestureName) {
    case SWIPE_UP:
    case SWIPE_DOWN:
      break;
    case SWIPE_LEFT:
      this.onSwipeLeft();
      break;
    case SWIPE_RIGHT:
      this.onSwipeRight();
      break;
    }
  }

  onSwipeLeft = () => {
    this.header.onPressRight();
  }

  onSwipeRight = () => {
    this.header.onPressLeft();
  }

  renderWeekNumber(weekNumber) {
    return (
      <View style={{flex: 1, alignItems: 'center'}} key={`week-container-${weekNumber}`}>
        <Day
          key={`week-${weekNumber}`}
          theme={this.props.theme}
          marking={{disableTouchEvent: true}}
          state='disabled'
        >
          {weekNumber}
        </Day>
      </View>
    );
  }

  renderWeek(days, id) {
    const week = [];
    days.forEach((day, id2) => {
      week.push(this.renderDay(day, id2));
    }, this);

    if (this.props.showWeekNumbers) {
      week.unshift(this.renderWeekNumber(days[days.length - 1].getWeek()));
    }

    return (<View style={this.style.week} key={id}>{week}</View>);
  }

  render() {
    this.style = styleConstructor(this.props.theme);
    const {currentMonth} = this.state;
    const {firstDay, showSixWeeks, hideExtraDays,enableSwipeMonths} = this.props;
    const shouldShowSixWeeks = showSixWeeks && !hideExtraDays;
    const days = dateutils.page(currentMonth, firstDay, shouldShowSixWeeks);

    const weeks = [];
    while (days.length) {
      weeks.push(this.renderWeek(days.splice(0, 7), weeks.length));
    }

    let indicator;
    const current = parseDate(this.props.current);
    if (current) {
      const lastMonthOfDay = current.clone().addMonths(1, true).setDate(1).addDays(-1).toString('yyyy-MM-dd');
      if (this.props.displayLoadingIndicator &&
        !(this.props.markedDates && this.props.markedDates[lastMonthOfDay])) {
        indicator = true;
      }
    }

    const GestureComponent = enableSwipeMonths ? GestureRecognizer : View;
    const gestureProps = enableSwipeMonths ? {onSwipe: (direction, state) => this.onSwipe(direction, state)} : {};

    return (
      <GestureComponent {...gestureProps}>
        <View
          style={[this.style.container, this.props.style]}
          accessibilityElementsHidden={this.props.accessibilityElementsHidden} // iOS
          importantForAccessibility={this.props.importantForAccessibility} // Android
        >
          <CalendarHeader
            testID={this.props.testID}
            ref={c => this.header = c}
            style={this.props.headerStyle}
            theme={this.props.theme}
            hideArrows={this.props.hideArrows}
            month={this.state.currentMonth}
            addMonth={this.addMonth}
            showIndicator={indicator}
            firstDay={this.props.firstDay}
            showSixWeeks={this.props.showSixWeeks}
            renderArrow={this.props.renderArrow}
            monthFormat={this.props.monthFormat}
            hideDayNames={this.props.hideDayNames}
            weekNumbers={this.props.showWeekNumbers}
            onPressArrowLeft={this.props.onPressArrowLeft}
            onPressArrowRight={this.props.onPressArrowRight}
            webAriaLevel={this.props.webAriaLevel}
            disableArrowLeft={this.props.disableArrowLeft}
            disableArrowRight={this.props.disableArrowRight}
            disabledDaysIndexes={this.props.disabledDaysIndexes}
            renderHeader={this.props.renderHeader}
            calendarLang={this.props.calendarLang}
          />
          <View style={this.style.monthView}>{weeks}</View>
        </View>
      </GestureComponent>
    );
  }
}

export default Calendar;
