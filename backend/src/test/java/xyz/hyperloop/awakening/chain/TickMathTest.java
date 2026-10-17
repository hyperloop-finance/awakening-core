package xyz.hyperloop.awakening.chain;
import org.junit.jupiter.api.Test;
import java.math.BigInteger;
import static org.junit.jupiter.api.Assertions.*;
class TickMathTest {
    @Test void pricesMatchSolidityAndRejectOutOfRange() {
        assertEquals(new BigInteger("500000000000000000"),TickMath.price(2910));
        assertEquals(new BigInteger("995664000000000000"),TickMath.price(4000));
        assertThrows(IllegalArgumentException.class,()->TickMath.price(5821));
    }
}
