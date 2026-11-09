package dev.collectionsviz.api.web;

import dev.collectionsviz.api.dto.ErrorResponse;
import dev.collectionsviz.api.admission.ApiAdmission;
import dev.collectionsviz.api.admission.ClientAddress;
import dev.collectionsviz.api.observability.ApiMetrics;

import java.io.IOException;
import java.util.Set;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.UrlPathHelper;

@Component
@Order(10)
public class ApiLimitFilter extends OncePerRequestFilter {
    public static final String CLIENT_ATTRIBUTE=ApiLimitFilter.class.getName()+".client";
    private final ApiMetrics metrics;
    private final ApiAdmission admission;
    private final ClientAddress address;
    private final ObjectMapper json;
    private final Set<String> origins;
    public ApiLimitFilter(ApiAdmission admission,ClientAddress address,ObjectMapper json,
                          @Value("${visualizer.allowed-origins}") String[] origins,ApiMetrics metrics) {
        this.metrics=metrics; this.admission=admission; this.address=address; this.json=json; this.origins=Set.of(origins);
    }
    @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain)
        throws ServletException,IOException {
        // Decode like MVC and remove matrix parameters; raw URI comparisons permit routing aliases.
        String path=UrlPathHelper.defaultInstance.getPathWithinApplication(request);
        boolean creation=path.equals("/api/v1/sessions") && request.getMethod().equals("POST");
        boolean work=path.startsWith("/api/") && (request.getMethod().equals("POST") ||
            (request.getMethod().equals("GET") && path.startsWith("/api/v1/sessions/")));
        if(!work) { chain.doFilter(request,response); return; }
        String client=address.resolve(request);
        request.setAttribute(CLIENT_ATTRIBUTE,client);
        ApiAdmission.Ticket ticket;
        try { ticket=admission.enter(client,creation); }
        catch(ApiAdmission.Limited limited) {
            reject(request,response,limited.code,limited.retryAfter); return;
        }
        try(ticket) {
            metrics.admitted(creation);
            chain.doFilter(request,response); // Includes encoding and response serialization.
        }
    }
    private void reject(HttpServletRequest request,HttpServletResponse response,String code,int retryAfter) throws IOException {
        metrics.rejected(429,code);
        response.setStatus(429);
        response.setHeader("Retry-After",Integer.toString(retryAfter));
        response.addHeader("Vary","Origin");
        String origin=request.getHeader("Origin");
        if(origin!=null && origins.contains(origin)) response.setHeader("Access-Control-Allow-Origin",origin);
        response.setContentType("application/json"); response.setCharacterEncoding("UTF-8");
        json.writeValue(response.getOutputStream(),new ErrorResponse(1,code,
            "Слишком много запросов. Повторите через "+retryAfter+" сек.; команда не выполнена."));
    }
}
