package dev.collectionsviz.api.admission;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import static org.junit.jupiter.api.Assertions.*;

class ClientAddressTest {
    @Test void untrustedSocketCannotChooseIdentityWithAnyProxyHeader() {
        var request=new MockHttpServletRequest(); request.setRemoteAddr("198.51.100.1");
        request.addHeader("X-Forwarded-For","203.0.113.1");
        request.addHeader("Forwarded","for=203.0.113.2");
        request.addHeader(ClientAddress.HEADER,"203.0.113.3");
        assertEquals("198.51.100.1",new ClientAddress("").resolve(request));
        assertEquals("198.51.100.1",new ClientAddress("127.0.0.1,::1").resolve(request));
    }
    @Test void onlySingleNumericCustomHeaderFromExactTrustedPeerIsAccepted() {
        var resolver=new ClientAddress("127.0.0.1,::1");
        var request=new MockHttpServletRequest(); request.setRemoteAddr("::ffff:127.0.0.1");
        request.addHeader(ClientAddress.HEADER,"::ffff:198.51.100.1");
        assertEquals("198.51.100.1",resolver.resolve(request));
        for(String value:new String[]{"example.com","198.51.100.1, 203.0.113.1","[::1]","::1%eth0","127.1","999.0.0.1",""}) {
            request.removeHeader(ClientAddress.HEADER); request.addHeader(ClientAddress.HEADER,value);
            assertEquals("127.0.0.1",resolver.resolve(request),value);
        }
        request.removeHeader(ClientAddress.HEADER);
        request.addHeader(ClientAddress.HEADER,"198.51.100.1"); request.addHeader(ClientAddress.HEADER,"203.0.113.1");
        assertEquals("127.0.0.1",resolver.resolve(request));
        assertThrows(IllegalArgumentException.class,()->new ClientAddress("localhost"));
        assertThrows(IllegalArgumentException.class,()->new ClientAddress("127.0.0.0/8"));
    }
}
