package dev.collectionsviz.api.observability;

import dev.collectionsviz.api.dto.SessionTrace;
import dev.collectionsviz.api.trace.CompactTraceRegistry;
import dev.collectionsviz.api.dto.CompactTraceResponse;

import java.io.IOException;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.core.MethodParameter;
import org.springframework.core.annotation.Order;
import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.server.*;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.UrlPathHelper;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyAdvice;

/**
 * Counts the existing Jackson byte stream; never retains or serializes the trace again.
 */
@ControllerAdvice
@Order(9)
public class TraceResponseMetrics extends OncePerRequestFilter implements ResponseBodyAdvice<Object> {
    private static final String TRACE = TraceResponseMetrics.class.getName() + ".trace";

    private record Kind(String collection, String encoding) {
    }

    private final ApiMetrics metrics;

    public TraceResponseMetrics(ApiMetrics metrics) {
        this.metrics = metrics;
    }

    @Override
    public boolean supports(MethodParameter method, Class<? extends HttpMessageConverter<?>> converter) {
        return true;
    }

    @Override
    public Object beforeBodyWrite(Object body, MethodParameter method, MediaType type,
                                  Class<? extends HttpMessageConverter<?>> converter, ServerHttpRequest request,
                                  ServerHttpResponse response) {
        Kind kind = null;
        if (body instanceof CompactTraceResponse trace)
            kind = new Kind(trace.trace().collection(), CompactTraceRegistry.COMPACT_ENCODING);
        else if (body instanceof SessionTrace<?> trace)
            kind = new Kind(trace.trace().collection(), CompactTraceRegistry.FULL_ENCODING);
        if (kind != null && request instanceof ServletServerHttpRequest servlet)
            servlet.getServletRequest().setAttribute(TRACE, kind);
        return body;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getMethod().equals("POST") ||
                !UrlPathHelper.defaultInstance.getPathWithinApplication(request).startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        var counted = new CountingResponse(response);
        boolean completed = false;
        try {
            chain.doFilter(request, counted);
            completed = true;
        } finally {
            if (request.getAttribute(TRACE) instanceof Kind kind)
                metrics.trace(kind.collection(), kind.encoding(), counted.bytes,
                        completed && !counted.failed && response.getStatus() < 400);
        }
    }

    static final class CountingResponse extends HttpServletResponseWrapper {
        long bytes;
        boolean failed;
        private ServletOutputStream stream;

        CountingResponse(HttpServletResponse response) {
            super(response);
        }

        @Override
        public ServletOutputStream getOutputStream() throws IOException {
            if (stream == null) {
                var target = super.getOutputStream();
                stream = new ServletOutputStream() {
                    @Override
                    public boolean isReady() {
                        return target.isReady();
                    }

                    @Override
                    public void setWriteListener(WriteListener listener) {
                        target.setWriteListener(listener);
                    }

                    @Override
                    public void write(int value) throws IOException {
                        try {
                            target.write(value);
                            bytes++;
                        } catch (IOException e) {
                            failed = true;
                            throw e;
                        }
                    }

                    @Override
                    public void write(byte[] data, int offset, int length) throws IOException {
                        try {
                            target.write(data, offset, length);
                            bytes += length;
                        } catch (IOException e) {
                            failed = true;
                            throw e;
                        }
                    }

                    @Override
                    public void flush() throws IOException {
                        try {
                            target.flush();
                        } catch (IOException e) {
                            failed = true;
                            throw e;
                        }
                    }

                    @Override
                    public void close() throws IOException {
                        try {
                            target.close();
                        } catch (IOException e) {
                            failed = true;
                            throw e;
                        }
                    }
                };
            }
            return stream;
        }

        @Override
        public void resetBuffer() {
            super.resetBuffer();
            bytes = 0;
        }

        @Override
        public void reset() {
            super.reset();
            bytes = 0;
        }
    }
}
