package xyz.hyperloop.awakening.chain;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import xyz.hyperloop.awakening.config.RuntimeConfigService;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class MultiChainTest {
    private DeploymentManifest manifest(long chain) {
        ObjectNode data=DeploymentManifest.load().data().deepCopy();data.put("chainId",chain);return new DeploymentManifest(data);
    }
    @Test void exposesEachChainIdentityAndRejectsOtherRpcChains() {
        for(long chain:new long[]{97,421614,46630}) {
            var m=manifest(chain);assertEquals(chain,m.chainId());
            assertEquals(chain==97?"bsc-testnet":chain==421614?"arbitrum-sepolia":"robinhood-testnet",m.profile());
            var rpc=mock(ChainGateway.class);when(rpc.chainId()).thenReturn(chain==97?421614L:97L);
            assertEquals("WRONG_CHAIN",new DeploymentVerifier(rpc,m).verify().reason());
            var order=new com.fasterxml.jackson.databind.ObjectMapper().createObjectNode().put("chainId",chain==97?421614:97);
            assertEquals("Wrong order chain",assertThrows(IllegalArgumentException.class,()->new OfferTreeVerifier(rpc,m).verify(order,1)).getMessage());
        }
    }
    @Test void rejectsCrossChainIndexerBeforeReadingDatabase() {
        var rpc=mock(ChainGateway.class);when(rpc.chainId()).thenReturn(97L);
        var indexer=new ChainEventIndexer(rpc,null,null,0,java.util.List.of(),12,421614,1000);
        assertThrows(IllegalStateException.class,indexer::sync);verify(rpc,never()).blockNumber();
    }
    @Test void isolatesEveryLiveProfileFromMockTestAndOtherLiveProfiles() {
        for(String first:new String[]{"bsc-testnet","arbitrum-sepolia","robinhood-testnet"})
            for(String second:new String[]{"mock","test","bsc-testnet","arbitrum-sepolia","robinhood-testnet"}) {
                if(first.equals(second))continue;var env=new MockEnvironment();env.setActiveProfiles(first,second);
                assertThrows(IllegalStateException.class,()->new RuntimeConfigService(null,env),first+"/"+second);
            }
    }
    @Test void verifiesSelectedCoreChainAndLinksOnBothNewChains() {
        for(long chain:new long[]{421614,46630}) {
            var m=manifest(chain);var rpc=mock(ChainGateway.class);
            when(rpc.chainId()).thenReturn(chain);when(rpc.blockNumber()).thenReturn(100L);
            when(rpc.code(anyString(),anyLong())).thenReturn("0x6000");
            when(rpc.uintCall(m.address("Awakening"),"INITIAL_CHAIN_ID()",100)).thenReturn(java.math.BigInteger.valueOf(chain));
            for(String[] pair:new String[][]{{"optionVault","OptionVault"},{"pat","AttestedPAT"},{"settlement","AwakeningSettlement"}})
                when(rpc.addressCall(m.address("Awakening"),pair[0]+"()",100)).thenReturn(m.address(pair[1]));
            for(String name:new String[]{"OptionVault","AwakeningSettlement","EcrecoverRatifier"})
                when(rpc.addressCall(m.address(name),"AWAKENING()",100)).thenReturn(m.address("Awakening"));
            when(rpc.addressCall(m.address("AttestedPAT"),"CUSTODIAN()",100)).thenReturn(m.custodian());
            assertEquals("VERIFIED",new DeploymentVerifier(rpc,m).verify().reason());
            when(rpc.uintCall(m.address("Awakening"),"INITIAL_CHAIN_ID()",100)).thenReturn(java.math.BigInteger.valueOf(97));
            assertEquals("WRONG_CORE_CHAIN",new DeploymentVerifier(rpc,m).verify().reason());
        }
    }
    @Test void marketAndOrderApisExposeSelectedChain() throws Exception {
        for(long chain:new long[]{97,421614,46630}) {
            var m=manifest(chain);((ObjectNode)m.data()).putArray("markets");
            var rpc=mock(ChainGateway.class);var repo=mock(ChainReadRepository.class);
            when(repo.cursor()).thenReturn(new ChainReadRepository.Cursor(100,"block"));
            var projection=new ChainProjectionService(rpc,repo,m);
            var runtime=mock(ChainRuntime.class);
            var mvc=org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup(new ChainController(runtime,projection)).build();
            mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/v1/chain/markets"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.chainId").value(chain))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.dataSource").value(m.dataSource()));
            when(repo.orders()).thenReturn(java.util.List.of());
            assertEquals(chain,new ChainOrderService(rpc,repo,null,m).list(null).path("chainId").asLong());
        }
    }
    @Test void selectsLiveProfileAndExcludesMockControllers() {
        for(String profile:DeploymentManifest.LIVE_PROFILES) {
            var env=new MockEnvironment();env.setActiveProfiles("local",profile);
            assertEquals(profile,DeploymentManifest.selectedProfile(env));
            var mock=xyz.hyperloop.awakening.market.MarketController.class.getAnnotation(org.springframework.context.annotation.Profile.class);
            assertFalse(env.acceptsProfiles(org.springframework.core.env.Profiles.of(mock.value())));
            var live=ChainController.class.getAnnotation(org.springframework.context.annotation.Profile.class);
            assertTrue(env.acceptsProfiles(org.springframework.core.env.Profiles.of(live.value())));
        }
    }
    @Test
    @org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable(named="BSC_DB_TESTS",matches="true")
    void newChainsUseSeparateOrderScopesAndBoundedLogRanges() throws Exception {
        var ds=new org.springframework.jdbc.datasource.DriverManagerDataSource("jdbc:postgresql://127.0.0.1:55432/awakening_bsc","awakening","awakening-local-test-only");
        new org.springframework.jdbc.datasource.init.ResourceDatabasePopulator(new org.springframework.core.io.ClassPathResource("db/migration/V2__chain_scope_and_cursor.sql")).execute(ds);
        var db=new org.springframework.jdbc.core.JdbcTemplate(ds);String unique=java.util.UUID.randomUUID().toString();
        var first=new ChainReadRepository(db,"421614:"+unique);var second=new ChainReadRepository(db,"46630:"+unique);
        var rpc=mock(ChainGateway.class);var mapper=new com.fasterxml.jackson.databind.ObjectMapper();
        when(rpc.chainId()).thenReturn(421614L);when(rpc.blockNumber()).thenReturn(6012L);
        when(rpc.request(eq("eth_getBlockByNumber"),any())).thenReturn(mapper.readTree("{\"hash\":\"stable\",\"parentHash\":\"parent\"}"));
        var ranges=new java.util.ArrayList<Long>();
        when(rpc.request(eq("eth_getLogs"),any())).thenAnswer(call->{
            var filter=(java.util.Map<?,?>)((java.util.List<?>)call.getArgument(1)).getFirst();
            ranges.add(ChainGateway.integer((String)filter.get("toBlock")).longValueExact()-ChainGateway.integer((String)filter.get("fromBlock")).longValueExact()+1);
            return mapper.readTree("[]");
        });
        try {
            first.saveOrder("same","maker","{}");second.saveOrder("same","maker","{}");
            assertEquals(1,first.orders().size());assertEquals(1,second.orders().size());
            new ChainEventIndexer(rpc,first,new org.springframework.transaction.support.TransactionTemplate(new org.springframework.jdbc.datasource.DataSourceTransactionManager(ds)),1,java.util.List.of("core"),12,421614,1000).sync();
            assertEquals(5000,first.cursor().block());assertNull(second.cursor());assertEquals(java.util.List.of(1000L,1000L,1000L,1000L,1000L),ranges);
        } finally {
            first.resetEvents();second.resetEvents();
            db.update("DELETE FROM chain_orders WHERE scope IN (?,?)","421614:"+unique,"46630:"+unique);
        }
    }
}
