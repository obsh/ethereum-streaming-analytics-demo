package com.google.allenday;

import com.google.allenday.calculation.Candlestick;
import com.google.allenday.calculation.CombineCandlestickFn;
import com.google.allenday.firestore.DataPoint;
import com.google.allenday.firestore.WriteDataToFirestoreDbFn;
import com.google.allenday.input.DeserializeTransaction;
import org.apache.beam.sdk.Pipeline;
import org.apache.beam.sdk.io.gcp.pubsub.PubsubIO;
import org.apache.beam.sdk.options.PipelineOptionsFactory;
import org.apache.beam.sdk.transforms.*;
import org.apache.beam.sdk.transforms.windowing.FixedWindows;
import org.apache.beam.sdk.transforms.windowing.Window;
import org.joda.time.Duration;

public class TransactionMetricsPipeline {

    public static void main(String[] args) {
        TransactionMetricsPipelineOptions options =
                PipelineOptionsFactory.fromArgs(args).withValidation().as(TransactionMetricsPipelineOptions.class);

        Pipeline pipeline = Pipeline.create(options);
        pipeline.apply("Reading PubSub", PubsubIO
                .readMessagesWithAttributes()
                .fromTopic(options.getInputDataTopic()))
                .apply("Deserialize JSON", ParDo.of(new DeserializeTransaction()))
                .apply("Fixed windows", Window.into(FixedWindows.of(Duration.standardSeconds(30))))

                // we have PCollection of transactions assigned to fixed windows
                // for each window need to produce record with 4 values and timestamp
                // {"timestamp": 1574543, "data": {"open": 3.3, "close": 3.5, "high": 3.6, "low": 0.1}}
                .apply("Calculate statistic", Combine.globally(new CombineCandlestickFn()).withoutDefaults())
                .apply("Prepare data points", ParDo.of(new DoFn<Candlestick, DataPoint>() {
                    @ProcessElement
                    public void processElement(ProcessContext c) {
                        Candlestick candlestick = c.element();

                        System.err.format("timestamp: %d, object: %s\n",
                                c.timestamp().getMillis(), candlestick.toString()
                        );

                        DataPoint dataPoint = new DataPoint();
                        dataPoint.setTimestamp(c.timestamp().getMillis());
                        dataPoint.setCandlestick(candlestick);

                        c.output(dataPoint);
                    }
                }))
                .apply("Write to FireStore", ParDo.of(
                        new WriteDataToFirestoreDbFn(options.getProject(), options.getFirestoreCollection())
                ))
        ;
        pipeline.run();
    }
}
