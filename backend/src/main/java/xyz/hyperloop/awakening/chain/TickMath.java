package xyz.hyperloop.awakening.chain;
import java.math.BigInteger;

/** Integer port of deployed TickLib, including ties-down rounding. */
public final class TickMath {
    public static final BigInteger WAD=BigInteger.TEN.pow(18);
    private TickMath() {}
    private static BigInteger exp(BigInteger x) {
        if(x.signum()<0)return WAD.multiply(WAD).divide(exp(x.negate()));
        var ln2=new BigInteger("693147180559945309");
        var q=x.add(new BigInteger("322611214989459870")).divide(ln2);
        var r=x.subtract(q.multiply(ln2));
        var second=r.multiply(r).divide(WAD.multiply(BigInteger.TWO));
        var third=second.multiply(r).divide(WAD.multiply(BigInteger.valueOf(3)));
        return WAD.add(r).add(second).add(third).shiftLeft(q.intValueExact());
    }
    private static BigInteger half(BigInteger x,BigInteger d) {return x.add(d.subtract(BigInteger.ONE).divide(BigInteger.TWO)).divide(d);}
    public static BigInteger price(int tick) {
        if(tick<0||tick>5820)throw new IllegalArgumentException("Tick outside contract curve");
        var step=BigInteger.TEN.pow(12);
        return half(half(WAD.multiply(WAD),WAD.add(exp(new BigInteger("4987541511039073").multiply(BigInteger.valueOf(2910L-tick))))),step).multiply(step);
    }
}
