import {
  StyleSheet,
  View,
  Text,
  Dimensions,
  useWindowDimensions,
} from 'react-native';
import {
  Canvas,
  Path,
  Circle,
  Group,
  usePathValue,
  vec,
  LinearGradient,
  RadialGradient,
  Shadow,
  Paint,
  Blur,
  Mask,
} from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  useSharedValue,
  useDerivedValue,
  runOnJS,
  withTiming,
} from 'react-native-reanimated';
import { useRef, useState } from 'react';

const { width } = Dimensions.get('window');
const CIRCLE_SIZE = width * 0.8;
const CIRCLE_STROKE_WIDTH = 70;
const INNER_CIRCLE_STROKE_WIDTH = CIRCLE_STROKE_WIDTH * 0.85;
const CIRCLE_RADIUS = (CIRCLE_SIZE - CIRCLE_STROKE_WIDTH) / 2;
const DOT_SIZE = 4;
const KNOB_SIZE = (INNER_CIRCLE_STROKE_WIDTH / 2) * 0.82;
const CENTER = CIRCLE_SIZE / 2;
const MAX_MONTHS = 12;

// Gradient colors for the progress arc
const progressGradientColors = ['#F04EA2', '#CD1D5E', '#D6215A', '#F13758'];
const progressGradientPositions = [0.5, 0.75, 0.85, 1.0];

export default function HomeScreen() {
  // Add a React state for the display value - initialize with the same value as progressReanimated (0.33 * 12 = ~4)
  const [displayText, setDisplayText] = useState('1');

  // Reanimated values for gestures and animations
  const progressReanimated = useSharedValue(0.1); // Initial value (4 months / 12 months)
  const isPressed = useSharedValue(false);
  const screen = useWindowDimensions();

  // Display value (snapped to nearest month)
  const displayValue = useDerivedValue(() => {
    // Calculate months value (0-12)
    const months = Math.round(progressReanimated.value * MAX_MONTHS);
    return months.toString();
  });

  // Use animated reaction to update the React state
  useDerivedValue(() => {
    runOnJS(setDisplayText)(displayValue.value);
  });

  // Create the arc path for the progress indicator using usePathValue
  const arcPath = usePathValue((path) => {
    'worklet';
    path.reset();
    const p = progressReanimated.value;
    const startAngle = -Math.PI / 2 / 1.06;
    const endAngle = -Math.PI / 2 + 2 * Math.PI * p;

    // Calculate the main arc points
    const arcRadius = CIRCLE_RADIUS;

    // Start point (flat cap)
    const startX = CENTER + Math.cos(startAngle) * arcRadius;
    const startY = CENTER + Math.sin(startAngle) * arcRadius;

    // Draw the arc
    path.moveTo(startX, startY);

    // Draw the arc using small line segments
    const steps = 64;
    for (let i = 0; i <= steps; i++) {
      const angle = startAngle + (endAngle - startAngle) * (i / steps);
      const x = CENTER + Math.cos(angle) * arcRadius;
      const y = CENTER + Math.sin(angle) * arcRadius;
      path.lineTo(x, y);
    }

    return path;
  });

  // Calculate the position of the knob
  const knobX = useDerivedValue(() => {
    const p = progressReanimated.value;
    const angle = -Math.PI / 2 + 2 * Math.PI * p;
    return CENTER + Math.cos(angle) * CIRCLE_RADIUS;
  });

  const knobY = useDerivedValue(() => {
    const p = progressReanimated.value;
    const angle = -Math.PI / 2 + 2 * Math.PI * p;
    return CENTER + Math.sin(angle) * CIRCLE_RADIUS;
  });

  // Create dots around the circle
  const dots = Array.from({ length: MAX_MONTHS }).map((_, index) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / MAX_MONTHS;
    const x = CENTER + Math.cos(angle) * CIRCLE_RADIUS;
    const y = CENTER + Math.sin(angle) * CIRCLE_RADIUS;
    return { x, y, index };
  });

  // Reference to the canvas container view for measuring position
  const canvasRef = useRef(null);

  // Handle gestures
  const gesture = Gesture.Pan()
    .onBegin(() => {
      isPressed.value = true;
    })
    .onUpdate((e) => {
      if (!canvasRef.current) return;

      // Calculate the offset applied by the transform
      const offsetX = screen.width / 2 - CIRCLE_SIZE / 2;
      const offsetY = screen.height / 2 - CIRCLE_SIZE / 2;

      // Get the touch position relative to the canvas center, accounting for the offset
      const touchX = e.x - (CENTER + offsetX);
      const touchY = e.y - (CENTER + offsetY);

      // Calculate the angle in radians
      let angle = Math.atan2(touchY, touchX);

      // Normalize angle to start from the top (12 o'clock position)
      angle = (angle + Math.PI * 2.5) % (Math.PI * 2);

      // Convert angle to progress (0-1) - stepless during dragging
      let newProgress = angle / (2 * Math.PI);

      // Ensure the progress is within bounds
      newProgress = Math.max(1 / MAX_MONTHS, Math.min(1, newProgress));

      // Update progress - no snapping during drag
      progressReanimated.value = newProgress;
    })
    .onEnd(() => {
      // Snap to nearest month when finger is lifted
      const nearestMonth =
        Math.round(progressReanimated.value * MAX_MONTHS) / MAX_MONTHS;
      progressReanimated.value = withTiming(nearestMonth, {
        duration: 100,
      });
      isPressed.value = false;
    });

  return (
    <View style={styles.container}>
      <GestureDetector gesture={gesture}>
        <View ref={canvasRef} style={styles.canvasContainer}>
          <Canvas style={styles.canvas}>
            <Group
              transform={[
                { translateX: screen.width / 2 - CIRCLE_SIZE / 2 },
                { translateY: screen.height / 2 - CIRCLE_SIZE / 2 },
              ]}
            >
              {/* Background circle */}
              <Circle
                cx={CENTER}
                cy={CENTER}
                r={CIRCLE_RADIUS}
                color="#F7F7F7"
                style="stroke"
                strokeWidth={CIRCLE_STROKE_WIDTH}
              >
                <Shadow dx={0} dy={12} blur={12} color="#00000030" inner />
                <Shadow dx={0} dy={-4} blur={4} color="#00000030" />
                <Shadow dx={0} dy={3} blur={2} color="#fff" />
              </Circle>

              {/* Dots around the circle */}
              <Group>
                {dots.map((dot) => (
                  <Circle
                    key={dot.index}
                    cx={dot.x}
                    cy={dot.y}
                    r={DOT_SIZE / 2}
                    color={'#6A6A6A'}
                  />
                ))}
              </Group>

              <Circle
                cx={CENTER}
                cy={CENTER}
                r={CIRCLE_RADIUS - CIRCLE_STROKE_WIDTH / 2}
                color="#F7F7F7"
              >
                <Shadow dx={0} dy={-7} blur={3} color="#0000001F" inner />
                <Shadow dx={0} dy={7} blur={3} color="#ffffff" inner />
              </Circle>
              <Group>
                <Mask
                  mask={
                    <Circle
                      cx={CENTER}
                      cy={CENTER}
                      r={CIRCLE_RADIUS}
                      style="stroke"
                      strokeWidth={CIRCLE_STROKE_WIDTH}
                    />
                  }
                >
                  <Group>
                    <Circle
                      cx={knobX}
                      cy={knobY}
                      r={(INNER_CIRCLE_STROKE_WIDTH / 2) * 2.5}
                      color="#FF385C"
                    >
                      <Blur blur={40} />
                    </Circle>
                  </Group>
                </Mask>
                <Blur blur={3} />
              </Group>

              <Group>
                <Mask
                  mask={
                    <Circle
                      cx={CENTER}
                      cy={CENTER}
                      r={CIRCLE_RADIUS}
                      style="stroke"
                      strokeWidth={CIRCLE_STROKE_WIDTH}
                    />
                  }
                >
                  <Group>
                    {/* Blur effect at the cap position (start of the arc) */}
                    <Circle
                      cx={CENTER}
                      cy={(CENTER - CIRCLE_RADIUS) * 1.15}
                      r={(INNER_CIRCLE_STROKE_WIDTH / 2) * 1.5}
                      color="#FF385C"
                    >
                      <Blur blur={30} />
                    </Circle>
                  </Group>
                </Mask>
                <Blur blur={3} />
              </Group>
              {/* Progress arc with shadows */}
              <Group
                layer={
                  <Paint>
                    <Shadow dx={0} dy={0} blur={2} color="#400E15" />
                    <Shadow dx={0} dy={0} blur={4} color="#D1193DCC" />
                    <Shadow dx={0} dy={0} blur={4} color="#D1193D99" />
                  </Paint>
                }
              >
                <Group
                  layer={
                    <Paint>
                      <Shadow dx={0} dy={0} blur={3} color="#D1193D" inner />
                      <Shadow dx={0} dy={0} blur={3} color="#D1193D" inner />
                    </Paint>
                  }
                >
                  {/* Main progress arc */}
                  <Path
                    path={arcPath}
                    color="#FF385C"
                    style="stroke"
                    strokeWidth={INNER_CIRCLE_STROKE_WIDTH}
                    strokeCap="butt"
                  >
                    <RadialGradient
                      c={vec(CENTER, CENTER)}
                      r={CIRCLE_SIZE / 2}
                      colors={progressGradientColors}
                      positions={progressGradientPositions}
                    />
                  </Path>

                  {/* Slightly rounded cap at the start position */}
                  <Path
                    path={usePathValue((path) => {
                      'worklet';
                      path.reset();

                      // Calculate dimensions for the rounded rectangle
                      const capWidth = INNER_CIRCLE_STROKE_WIDTH / 4;
                      const capHeight = INNER_CIRCLE_STROKE_WIDTH * 1.0003;
                      const cornerRadius = INNER_CIRCLE_STROKE_WIDTH / 8;

                      // Position the cap at the start of the arc (top of circle)
                      const capX = CENTER - capWidth / 10;
                      const capY =
                        (CENTER - CIRCLE_RADIUS - capHeight / 2) * 1.15;

                      // Draw rounded rectangle with adjusted top-right corner
                      path.moveTo(capX + cornerRadius, capY);
                      // Top edge (stops before the corner)
                      path.lineTo(capX + capWidth - cornerRadius, capY);
                      // Top-right corner (pushed down)
                      path.quadTo(
                        capX + capWidth,
                        capY,
                        capX + capWidth + 2,
                        capY + 0.1
                      );
                      // Right edge
                      path.lineTo(capX + capWidth, capY + capHeight);
                      // Bottom-right corner
                      path.quadTo(
                        capX + capWidth,
                        capY + capHeight,
                        capX + capWidth - cornerRadius,
                        capY + capHeight
                      );
                      // Bottom edge
                      path.lineTo(capX + cornerRadius, capY + capHeight);
                      // Bottom-left corner
                      path.quadTo(
                        capX,
                        capY + capHeight,
                        capX,
                        capY + capHeight - cornerRadius
                      );
                      // Left edge
                      path.lineTo(capX, capY + cornerRadius);
                      // Top-left corner
                      path.quadTo(capX, capY, capX + cornerRadius, capY);

                      path.close();
                      return path;
                    })}
                    color="#FF385C"
                    style="fill"
                  >
                    <RadialGradient
                      c={vec(CENTER, CENTER)}
                      r={CIRCLE_SIZE / 2}
                      colors={progressGradientColors}
                      positions={progressGradientPositions}
                    />
                  </Path>

                  {/* End cap circle */}
                  <Circle
                    cx={knobX}
                    cy={knobY}
                    r={INNER_CIRCLE_STROKE_WIDTH / 2}
                    color="#FF385C"
                    style="fill"
                  >
                    <RadialGradient
                      c={vec(CENTER, CENTER)}
                      r={CIRCLE_SIZE / 2}
                      colors={progressGradientColors}
                      positions={progressGradientPositions}
                    />
                  </Circle>
                </Group>
              </Group>

              {/* White knob at the end of the progress */}
              <Group
                transform={useDerivedValue(() => [
                  { translateX: knobX.value },
                  { translateY: knobY.value },
                  { scale: isPressed.value ? 1.05 : 1 },
                ])}
              >
                {/* Gradient Border Circle */}
                <Circle
                  cx={0}
                  cy={0}
                  r={KNOB_SIZE}
                  style="stroke"
                  strokeWidth={3}
                >
                  <LinearGradient
                    start={vec(0, KNOB_SIZE)}
                    end={vec(0, -KNOB_SIZE)}
                    colors={['#BFBFBF', '#fff']}
                  />
                </Circle>

                {/* Inner Filled Circle */}
                <Circle cx={0} cy={0} r={KNOB_SIZE - 1} style="fill">
                  <LinearGradient
                    start={vec(0, -KNOB_SIZE)}
                    end={vec(0, KNOB_SIZE)}
                    colors={['#D5D5D5', '#fff']}
                  />
                </Circle>
              </Group>
            </Group>
          </Canvas>
        </View>
      </GestureDetector>

      {/* Display the current month value */}
      <View style={styles.valueContainer}>
        <Text style={styles.valueText}>{displayText}</Text>
        <Text style={styles.unitText}>months</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7F7F7',
  },
  canvasContainer: {
    width: '100%',
    height: '100%',
  },
  canvas: {
    width: '100%',
    height: '100%',
  },
  valueContainer: {
    position: 'absolute',
    alignItems: 'center',
  },
  valueText: {
    fontFamily: 'AirbnbCereal',
    fontSize: 130,
    fontWeight: 'bold',
    color: '#222222',
    marginTop: -30,
  },
  unitText: {
    fontFamily: 'AirbnbCereal',
    fontSize: 24,
    fontWeight: 'bold',
    color: '#222222',
    marginTop: -25,
  },
});
